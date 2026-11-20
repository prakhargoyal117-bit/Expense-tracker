import { useState, type FormEvent } from 'react';
import { Cloud, KeyRound, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { EncryptedVaultEnvelope } from '../types/expense';
import { DEFAULT_VAULT_PASSPHRASE } from '../data/seedData';
import { GoogleSignInButton } from './GoogleSignInButton';

interface VaultLockScreenProps {
  envelope: EncryptedVaultEnvelope | null;
  googleUser: User | null;
  isSigningInGoogle: boolean;
  isRedirectingGoogle: boolean;
  showRedirectFallback: boolean;
  cloudVaultAvailable: boolean;
  cloudStatus: string | null;
  onUnlock: (passphrase: string) => Promise<boolean>;
  onUnlockCloudVault: (passphrase: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<void>;
  onGoogleRedirectSignIn: () => Promise<void>;
  onCancelGoogleSignIn: () => void;
  onWipeAllData: () => Promise<void>;
  onOpenCreateVault: (mode: 'create' | 'import') => void;
}

export function VaultLockScreen({
  envelope,
  googleUser,
  isSigningInGoogle,
  isRedirectingGoogle,
  showRedirectFallback,
  cloudVaultAvailable,
  cloudStatus,
  onUnlock,
  onUnlockCloudVault,
  onGoogleSignIn,
  onGoogleRedirectSignIn,
  onCancelGoogleSignIn,
  onWipeAllData,
  onOpenCreateVault,
}: VaultLockScreenProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passphrase.trim()) {
      setError('Enter your vault passphrase to decrypt your financial records.');
      return;
    }

    setIsDecrypting(true);
    const ok = cloudVaultAvailable
      ? await onUnlockCloudVault(passphrase)
      : await onUnlock(passphrase);
    setIsDecrypting(false);

    if (!ok) {
      setError('Invalid passphrase. AES-256-GCM decryption failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {cloudVaultAvailable
                ? 'Unlock Cloud Synced Vault'
                : 'SpendVault Locked'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Encrypted with {envelope?.algorithm ?? 'AES-256-GCM'} ·{' '}
              {envelope?.kdf ?? 'PBKDF2-SHA256'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          {cloudVaultAvailable
            ? `Found your encrypted cloud vault for ${googleUser?.email ?? 'your Google account'}. Enter your vault passphrase to open it in this browser.`
            : 'All connected app insights, IRCTC tickets, cash logs, and daily summaries remain encrypted. Enter your vault passphrase to unlock.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="unlock-passphrase"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Vault Passphrase
            </label>
            <div className="relative">
              <KeyRound
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="unlock-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError(null);
                }}
                placeholder="Enter vault passphrase"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            {error && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isDecrypting}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {isDecrypting
                ? 'Decrypting Vault...'
                : cloudVaultAvailable
                  ? 'Decrypt & Open Cloud Vault'
                  : 'Decrypt & Unlock Vault'}
            </span>
          </button>
        </form>

        {/* Cross-browser Cloud Sync sign-in right on Lock Screen */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Cloud className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span>Created your vault on another browser (Brave / Chrome / phone)?</span>
          </div>

          {cloudStatus && (
            <p
              role="status"
              className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
            >
              {cloudStatus}
            </p>
          )}

          {!googleUser ? (
            <div className="flex flex-wrap items-center gap-2">
              <GoogleSignInButton
                disabled={isSigningInGoogle || isRedirectingGoogle}
                onClick={() => void onGoogleSignIn()}
                label={
                  isRedirectingGoogle
                    ? 'Redirecting to Google...'
                    : isSigningInGoogle
                      ? 'Waiting for Google Sign-In...'
                      : 'Sign in with Google for Cloud Vault'
                }
              />
              {showRedirectFallback && (
                <button
                  type="button"
                  disabled={isRedirectingGoogle}
                  onClick={() => void onGoogleRedirectSignIn()}
                  className="px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Try Redirect Sign-In
                </button>
              )}
              {isSigningInGoogle && (
                <button
                  type="button"
                  onClick={onCancelGoogleSignIn}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Signed in as <strong className="text-slate-800">{googleUser.email}</strong>.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => onOpenCreateVault('create')}
            className="font-medium text-teal-800 hover:text-teal-950"
          >
            Create Personal Vault
          </button>
          <button
            type="button"
            onClick={() => onOpenCreateVault('import')}
            className="font-medium text-slate-700 hover:text-slate-900"
          >
            Restore Backup (.json)
          </button>
        </div>

        {envelope && !envelope.hasCustomPassphrase && !cloudVaultAvailable && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Using default local session key
            </span>
            <button
              type="button"
              onClick={() => void onUnlock(DEFAULT_VAULT_PASSPHRASE)}
              className="text-xs font-medium text-teal-800 hover:text-teal-950"
            >
              Open Local Vault
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {confirmWipe ? (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-red-700">
                Delete local{googleUser ? ' & cloud' : ''} vault data?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={async () => {
                    setIsWiping(true);
                    await onWipeAllData();
                    setIsWiping(false);
                    setConfirmWipe(false);
                  }}
                  className="px-2.5 py-1 font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded"
                >
                  {isWiping ? 'Deleting...' : 'Confirm Wipe'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmWipe(false)}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-xs text-slate-500">Want a clean start?</span>
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete All Data & Start Fresh</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
