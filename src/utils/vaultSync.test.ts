import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialVaultData } from '../data/seedData';
import type { EncryptedVaultEnvelope } from '../types/expense';
import { ExpenseCategory, PaymentMode } from '../types/expense';
import {
  decideCloudReconciliation,
  isVaultEffectivelyBlank,
  shouldForceGmailConsent,
} from './vaultSync';

function makeEnvelope(overrides: Partial<EncryptedVaultEnvelope> = {}): EncryptedVaultEnvelope {
  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    saltBase64: 'AAAAAAAAAAAAAAAAAAAAAA==',
    ivBase64: 'AAAAAAAAAAAAAAAA',
    ciphertextBase64: 'BBBBBBBBBBBBBBBBBBBBBBBB',
    updatedAt: '2026-11-20T10:00:00.000Z',
    hasCustomPassphrase: false,
    ...overrides,
  };
}

test('createInitialVaultData starts completely blank with zero pre-loaded expenses or connected apps', () => {
  const clean = createInitialVaultData();
  assert.equal(clean.expenses.length, 0);
  assert.equal(clean.apps.filter((a) => a.isConnected).length, 0);
  assert.ok(clean.apps.some((a) => a.id === 'eatsure'));
  assert.ok(clean.apps.some((a) => a.id === 'upi_payment'));
  assert.equal(isVaultEffectivelyBlank(clean, makeEnvelope()), true);
});

test('decideCloudReconciliation prompts for passphrase when opening a new browser with a custom-passphrase cloud vault', () => {
  const blankLocal = createInitialVaultData();
  const localEnv = makeEnvelope({
    ciphertextBase64: 'LOCAL_BLANK_CIPHERTEXT',
    hasCustomPassphrase: false,
  });
  const cloudEnv = makeEnvelope({
    ciphertextBase64: 'BRAVE_PERSONAL_VAULT_CIPHERTEXT',
    hasCustomPassphrase: true,
    updatedAt: '2026-11-20T12:00:00.000Z',
  });

  assert.equal(
    decideCloudReconciliation({
      localVault: blankLocal,
      localEnvelope: localEnv,
      cloudEnvelope: cloudEnv,
    }),
    'prompt_cloud_unlock',
  );
});

test('decideCloudReconciliation auto-pulls default-key cloud vault onto a blank browser', () => {
  const blankLocal = createInitialVaultData();
  const localEnv = makeEnvelope({ ciphertextBase64: 'LOCAL_BLANK' });
  const cloudEnv = makeEnvelope({
    ciphertextBase64: 'CLOUD_DEFAULT_VAULT',
    hasCustomPassphrase: false,
  });

  assert.equal(
    decideCloudReconciliation({
      localVault: blankLocal,
      localEnvelope: localEnv,
      cloudEnvelope: cloudEnv,
    }),
    'auto_pull_default',
  );
});

test('decideCloudReconciliation auto-pushes local user vault when cloud is empty', () => {
  const userVault = createInitialVaultData();
  userVault.studentName = 'Prakhar Goyal';
  userVault.expenses.push({
    id: 'exp-1',
    merchant: 'EatSure Wrap',
    amount: 220,
    date: '2026-11-20',
    time: '13:00',
    mode: PaymentMode.ONLINE,
    category: ExpenseCategory.FOOD,
    appId: 'eatsure',
    source: 'manual',
  });

  assert.equal(
    decideCloudReconciliation({
      localVault: userVault,
      localEnvelope: makeEnvelope({ hasCustomPassphrase: true }),
      cloudEnvelope: null,
    }),
    'auto_push_local',
  );
});

test('decideCloudReconciliation returns up_to_date when local and cloud ciphertexts match', () => {
  const userVault = createInitialVaultData();
  userVault.studentName = 'Prakhar Goyal';
  const env = makeEnvelope({
    ciphertextBase64: 'IDENTICAL_CIPHERTEXT',
    ivBase64: 'IDENTICAL_IV',
    hasCustomPassphrase: true,
  });

  assert.equal(
    decideCloudReconciliation({
      localVault: userVault,
      localEnvelope: env,
      cloudEnvelope: { ...env },
    }),
    'up_to_date',
  );
});

test('shouldForceGmailConsent avoids unnecessary re-verification unless scope was missing or explicitly requested', () => {
  assert.equal(
    shouldForceGmailConsent({ missingScopeFromLastAttempt: false }),
    false,
  );
  assert.equal(
    shouldForceGmailConsent({ missingScopeFromLastAttempt: true }),
    true,
  );
  assert.equal(
    shouldForceGmailConsent({
      missingScopeFromLastAttempt: false,
      explicitReauthorize: true,
    }),
    true,
  );
});

test('isSwitchingGoogleAccount and decideCloudReconciliation prevent pushing previous user data into a switched account', async () => {
  const { isSwitchingGoogleAccount } = await import('./vaultSync');
  assert.equal(isSwitchingGoogleAccount(null, 'uid-friend'), false);
  assert.equal(isSwitchingGoogleAccount('uid-owner', 'uid-owner'), false);
  assert.equal(isSwitchingGoogleAccount('uid-owner', 'uid-friend'), true);

  const ownerVault = createInitialVaultData();
  ownerVault.studentName = 'Owner';
  ownerVault.expenses.push({
    id: 'exp-uber-owner',
    merchant: 'Uber Trip',
    amount: 320,
    date: '2026-11-20',
    time: '09:00',
    mode: PaymentMode.ONLINE,
    category: ExpenseCategory.TRANSPORT,
    appId: 'uber',
    source: 'app_sync',
  });

  // When switching to a friend who has no cloud vault yet, never push owner's local vault
  assert.equal(
    decideCloudReconciliation({
      localVault: ownerVault,
      localEnvelope: makeEnvelope({ hasCustomPassphrase: false }),
      cloudEnvelope: null,
      switchedAccount: true,
    }),
    'up_to_date',
  );

  // When switching to a friend who has a cloud vault, always pull their cloud vault
  assert.equal(
    decideCloudReconciliation({
      localVault: ownerVault,
      localEnvelope: makeEnvelope({
        ciphertextBase64: 'OWNER_DATA',
        updatedAt: '2026-11-20T18:00:00.000Z',
      }),
      cloudEnvelope: makeEnvelope({
        ciphertextBase64: 'FRIEND_DATA',
        updatedAt: '2026-11-19T10:00:00.000Z',
        hasCustomPassphrase: false,
      }),
      switchedAccount: true,
    }),
    'auto_pull_default',
  );
});

