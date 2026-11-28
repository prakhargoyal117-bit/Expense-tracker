export type GmailAccessStep =
  | 'sign_in'
  | 'checking_cloud'
  | 'cloud_error'
  | 'create_password'
  | 'enter_password'
  | 'unlocked_ready';

export type VaultKeyAccessStep =
  | 'unlock_key'
  | 'setup_or_open'
  | 'unlocked_ready';

export interface AccessGateInput {
  isSignedInWithGoogle: boolean;
  hasLocalCustomKey: boolean;
  hasCloudCustomVault: boolean;
  isVaultUnlockedInSession: boolean;
  isCheckingCloudVault?: boolean;
  hasCloudCheckError?: boolean;
}

export interface AccessGateState {
  gmailStep: GmailAccessStep;
  vaultStep: VaultKeyAccessStep;
  recommendedTab: 'gmail' | 'vault';
}

/**
 * Pure access-gate resolver for the SpendVault Home Menu:
 * - Gmail / Google users authenticate via Google, wait while SpendVault checks Firestore
 *   for an existing cloud vault, then enter (returning/other browser) or create (first time)
 *   their Inside Menu Password to decrypt and open the Inside Menu.
 * - A pending cloud vault (hasCloudCustomVault) ALWAYS requires entering the Inside Menu Password,
 *   even if a blank default local vault is open in memory on a fresh browser.
 * - Vault Key users unlock directly with their local AES-256-GCM Vault Key
 *   (or create a new Vault Key / restore a backup / open a fresh local workspace).
 */
export function resolveAccessGateState(input: AccessGateInput): AccessGateState {
  let gmailStep: GmailAccessStep;
  if (!input.isSignedInWithGoogle) {
    gmailStep = 'sign_in';
  } else if (input.isCheckingCloudVault) {
    gmailStep = 'checking_cloud';
  } else if (input.hasCloudCustomVault) {
    gmailStep = 'enter_password';
  } else if (input.hasCloudCheckError && !input.hasLocalCustomKey) {
    gmailStep = 'cloud_error';
  } else if (input.isVaultUnlockedInSession && input.hasLocalCustomKey) {
    gmailStep = 'unlocked_ready';
  } else if (input.hasLocalCustomKey) {
    gmailStep = 'enter_password';
  } else {
    gmailStep = 'create_password';
  }

  let vaultStep: VaultKeyAccessStep;
  if (input.isVaultUnlockedInSession && input.hasLocalCustomKey) {
    vaultStep = 'unlocked_ready';
  } else if (input.hasLocalCustomKey) {
    vaultStep = 'unlock_key';
  } else {
    vaultStep = 'setup_or_open';
  }

  const recommendedTab: 'gmail' | 'vault' =
    input.isSignedInWithGoogle
      ? 'gmail'
      : input.hasLocalCustomKey
        ? 'vault'
        : 'gmail';

  return {
    gmailStep,
    vaultStep,
    recommendedTab,
  };
}

export function validateInsidePasswordSetup(
  password: string,
  confirmPassword: string,
): string | null {
  if (password.trim().length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match. Re-enter both fields identically.';
  }
  return null;
}

export function validateVaultKeyInput(key: string): string | null {
  if (!key.trim()) {
    return 'Enter your vault key to decrypt and open your vault.';
  }
  return null;
}
