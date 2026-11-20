import type { EncryptedVaultEnvelope, VaultData } from '../types/expense';

export type CloudReconcileAction =
  | 'auto_pull_default'
  | 'prompt_cloud_unlock'
  | 'auto_push_local'
  | 'up_to_date';

export function isVaultEffectivelyBlank(
  vault: VaultData | null,
  envelope: EncryptedVaultEnvelope | null,
): boolean {
  if (!vault) return !envelope?.hasCustomPassphrase;
  const hasConnectedApps = vault.apps.some((a) => a.isConnected);
  const hasCustomProfile =
    vault.studentName.trim() !== '' &&
    vault.studentName.trim() !== 'Personal Vault';
  return (
    vault.expenses.length === 0 &&
    !hasConnectedApps &&
    !hasCustomProfile &&
    !envelope?.hasCustomPassphrase
  );
}

export function decideCloudReconciliation(params: {
  localVault: VaultData | null;
  localEnvelope: EncryptedVaultEnvelope | null;
  cloudEnvelope: EncryptedVaultEnvelope | null;
}): CloudReconcileAction {
  const { localVault, localEnvelope, cloudEnvelope } = params;
  const localBlank = isVaultEffectivelyBlank(localVault, localEnvelope);

  if (!cloudEnvelope) {
    return localBlank ? 'up_to_date' : 'auto_push_local';
  }

  // Same ciphertext already loaded locally
  if (
    localEnvelope &&
    localEnvelope.ciphertextBase64 === cloudEnvelope.ciphertextBase64 &&
    localEnvelope.ivBase64 === cloudEnvelope.ivBase64
  ) {
    return 'up_to_date';
  }

  // Fresh browser (e.g. Chrome after creating vault on Brave)
  if (localBlank) {
    return cloudEnvelope.hasCustomPassphrase
      ? 'prompt_cloud_unlock'
      : 'auto_pull_default';
  }

  const localTs = localEnvelope?.updatedAt
    ? Date.parse(localEnvelope.updatedAt)
    : 0;
  const cloudTs = cloudEnvelope.updatedAt
    ? Date.parse(cloudEnvelope.updatedAt)
    : 0;

  if (Number.isFinite(cloudTs) && Number.isFinite(localTs) && cloudTs > localTs + 2000) {
    return cloudEnvelope.hasCustomPassphrase
      ? 'prompt_cloud_unlock'
      : 'auto_pull_default';
  }

  return 'auto_push_local';
}

export function shouldForceGmailConsent(params: {
  missingScopeFromLastAttempt: boolean;
  explicitReauthorize?: boolean;
}): boolean {
  return Boolean(
    params.missingScopeFromLastAttempt || params.explicitReauthorize,
  );
}
