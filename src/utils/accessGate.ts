export type GmailAccessStep =
  | 'sign_in'
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
}

export interface AccessGateState {
  gmailStep: GmailAccessStep;
  vaultStep: VaultKeyAccessStep;
  recommendedTab: 'gmail' | 'vault';
}

/**
 * Pure access-gate resolver for the SpendVault Home Menu:
 * - Gmail / Google users authenticate via Google, then set (first time) or enter
 *   their Inside Menu Password to decrypt and open the Inside Menu.
 * - Vault Key users unlock directly with their local AES-256-GCM Vault Key
 *   (or create a new Vault Key / restore a backup / open a fresh local workspace).
 */
export function resolveAccessGateState(input: AccessGateInput): AccessGateState {
  const needsPasswordForGmail =
    input.hasCloudCustomVault || input.hasLocalCustomKey;

  let gmailStep: GmailAccessStep;
  if (!input.isSignedInWithGoogle) {
    gmailStep = 'sign_in';
  } else if (input.isVaultUnlockedInSession && needsPasswordForGmail) {
    gmailStep = 'unlocked_ready';
  } else if (needsPasswordForGmail) {
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
