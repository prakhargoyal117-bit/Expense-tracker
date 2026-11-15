import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSha256Fingerprint,
  decryptVaultPayload,
  encryptVaultPayload,
} from './crypto';
import { createInitialVaultData } from '../data/seedData';

test('encryptVaultPayload and decryptVaultPayload perform real AES-256-GCM roundtrip', async () => {
  const vault = createInitialVaultData();
  const passphrase = 'correct-horse-battery-staple';

  const envelope = await encryptVaultPayload(vault, passphrase, true);

  assert.equal(envelope.version, 1);
  assert.equal(envelope.algorithm, 'AES-256-GCM');
  assert.equal(envelope.kdf, 'PBKDF2-SHA256');
  assert.equal(envelope.hasCustomPassphrase, true);
  assert.ok(envelope.ciphertextBase64.length > 50);
  assert.ok(!envelope.ciphertextBase64.includes('Zomato'));

  const decrypted = await decryptVaultPayload<typeof vault>(envelope, passphrase);
  assert.equal(decrypted.studentName, vault.studentName);
  assert.equal(decrypted.expenses.length, vault.expenses.length);
  assert.equal(decrypted.apps.length, vault.apps.length);
});

test('encryptVaultPayload uses a fresh IV and salt on every encryption call', async () => {
  const sample = { total: 420 };
  const pass = 'campus-secret';

  const env1 = await encryptVaultPayload(sample, pass);
  const env2 = await encryptVaultPayload(sample, pass);

  assert.notEqual(env1.ivBase64, env2.ivBase64);
  assert.notEqual(env1.saltBase64, env2.saltBase64);
  assert.notEqual(env1.ciphertextBase64, env2.ciphertextBase64);
});

test('decryptVaultPayload rejects wrong passphrase', async () => {
  const sample = { note: 'Private hostel expenses' };
  const envelope = await encryptVaultPayload(sample, 'right-pass');

  await assert.rejects(
    async () => decryptVaultPayload(envelope, 'wrong-pass'),
    /Decryption failed/,
  );
});

test('decryptVaultPayload detects tampered ciphertext', async () => {
  const sample = { amount: 1000 };
  const envelope = await encryptVaultPayload(sample, 'right-pass');
  const tampered = {
    ...envelope,
    ciphertextBase64:
      envelope.ciphertextBase64.slice(0, -4) +
      (envelope.ciphertextBase64.endsWith('AAAA') ? 'BBBB' : 'AAAA'),
  };

  await assert.rejects(
    async () => decryptVaultPayload(tampered, 'right-pass'),
    /Decryption failed/,
  );
});

test('computeSha256Fingerprint returns deterministic colon-separated hex digest', async () => {
  const fp1 = await computeSha256Fingerprint('abc');
  const fp2 = await computeSha256Fingerprint('abc');
  const fp3 = await computeSha256Fingerprint('abd');

  assert.equal(fp1, fp2);
  assert.notEqual(fp1, fp3);
  assert.match(fp1, /^[0-9A-F]{2}(:[0-9A-F]{2}){7}$/);
});
