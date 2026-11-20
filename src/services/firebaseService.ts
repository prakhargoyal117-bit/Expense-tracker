import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { EncryptedVaultEnvelope } from '../types/expense';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export interface GoogleSignInOptions {
  forceConsent?: boolean;
  loginHint?: string | null;
}

function buildGoogleProvider(options?: GoogleSignInOptions): GoogleAuthProvider {
  const googleProvider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    googleProvider.addScope(scope);
  }
  const params: Record<string, string> = {
    include_granted_scopes: 'true',
  };
  if (options?.forceConsent) {
    params.prompt = 'consent select_account';
  } else if (options?.loginHint) {
    params.login_hint = options.loginHint;
  } else {
    params.prompt = 'select_account';
  }
  googleProvider.setCustomParameters(params);
  return googleProvider;
}

// Keep OAuth token strictly in memory (never in localStorage or sessionStorage)
let cachedGmailAccessToken: string | null = null;
let isSigningIn = false;
let activeSignInPromise: Promise<{
  user: User;
  accessToken: string | null;
}> | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on initial boot
export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export function initFirebaseAuth(
  onUserChange: (user: User | null, gmailToken: string | null) => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedGmailAccessToken = null;
      onUserChange(null, null);
    } else if (!isSigningIn) {
      onUserChange(user, cachedGmailAccessToken);
    }
  });
}

export async function signInWithGoogleForVaultAndGmail(
  options?: GoogleSignInOptions,
): Promise<{
  user: User;
  accessToken: string | null;
}> {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  const googleProvider = buildGoogleProvider(options);
  isSigningIn = true;
  activeSignInPromise = (async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      cachedGmailAccessToken = credential?.accessToken ?? null;
      return { user: result.user, accessToken: cachedGmailAccessToken };
    } finally {
      isSigningIn = false;
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
}

export function resetPendingGoogleSignIn(): void {
  isSigningIn = false;
  activeSignInPromise = null;
}

export async function signInWithGoogleRedirectFallback(
  options?: GoogleSignInOptions,
): Promise<void> {
  if (typeof window !== 'undefined' && window.self !== window.top) {
    throw new Error(
      'Redirect sign-in cannot run inside an embedded preview frame. Allow popups or open the standalone app URL in a browser tab.',
    );
  }
  resetPendingGoogleSignIn();
  const googleProvider = buildGoogleProvider(options);
  await signInWithRedirect(auth, googleProvider);
}

export async function consumeGoogleRedirectResult(): Promise<{
  user: User;
  accessToken: string | null;
} | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedGmailAccessToken = credential?.accessToken ?? null;
  return { user: result.user, accessToken: cachedGmailAccessToken };
}

export function getInMemoryGmailToken(): string | null {
  return cachedGmailAccessToken;
}

export function clearInMemoryGmailToken(): void {
  cachedGmailAccessToken = null;
}

export async function signOutGoogle(): Promise<void> {
  cachedGmailAccessToken = null;
  await signOut(auth);
}

export interface CloudVaultRecord {
  envelope: EncryptedVaultEnvelope;
  syncedAtIso: string;
}

export async function fetchCloudEncryptedVault(
  userId: string,
): Promise<CloudVaultRecord | null> {
  const path = `vaults/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'vaults', userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const updatedAtIso =
      data.updatedAt && typeof data.updatedAt.toDate === 'function'
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString();

    return {
      envelope: {
        version: 1,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: Number(data.iterations ?? 100000),
        saltBase64: String(data.saltBase64),
        ivBase64: String(data.ivBase64),
        ciphertextBase64: String(data.ciphertextBase64),
        updatedAt: updatedAtIso,
        hasCustomPassphrase: Boolean(data.hasCustomPassphrase),
      },
      syncedAtIso: updatedAtIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCloudEncryptedVault(
  userId: string,
  envelope: EncryptedVaultEnvelope,
): Promise<void> {
  const path = `vaults/${userId}`;
  const docRef = doc(db, 'vaults', userId);

  let exists = false;
  try {
    const existingSnap = await getDoc(docRef);
    exists = existingSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(docRef, {
        ownerId: userId,
        version: 1,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: envelope.iterations,
        saltBase64: envelope.saltBase64,
        ivBase64: envelope.ivBase64,
        ciphertextBase64: envelope.ciphertextBase64,
        hasCustomPassphrase: envelope.hasCustomPassphrase,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(docRef, {
        saltBase64: envelope.saltBase64,
        ivBase64: envelope.ivBase64,
        ciphertextBase64: envelope.ciphertextBase64,
        hasCustomPassphrase: envelope.hasCustomPassphrase,
        iterations: envelope.iterations,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deleteCloudEncryptedVault(userId: string): Promise<void> {
  const path = `vaults/${userId}`;
  try {
    await deleteDoc(doc(db, 'vaults', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
