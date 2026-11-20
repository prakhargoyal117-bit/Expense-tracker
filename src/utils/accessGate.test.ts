import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAccessGateState,
  validateInsidePasswordSetup,
  validateVaultKeyInput,
} from './accessGate';

test('resolveAccessGateState prompts signed-out users on fresh browser to sign in with Google or set up a vault key', () => {
  const state = resolveAccessGateState({
    isSignedInWithGoogle: false,
    hasLocalCustomKey: false,
    hasCloudCustomVault: false,
    isVaultUnlockedInSession: false,
  });
  assert.equal(state.gmailStep, 'sign_in');
  assert.equal(state.vaultStep, 'setup_or_open');
  assert.equal(state.recommendedTab, 'gmail');
});

test('resolveAccessGateState requires first-time Gmail users without a password to create an Inside Menu Password', () => {
  const state = resolveAccessGateState({
    isSignedInWithGoogle: true,
    hasLocalCustomKey: false,
    hasCloudCustomVault: false,
    isVaultUnlockedInSession: true,
  });
  assert.equal(state.gmailStep, 'create_password');
  assert.equal(state.recommendedTab, 'gmail');
});

test('resolveAccessGateState requires returning Gmail users with a cloud or local password to enter their Inside Menu Password', () => {
  const state = resolveAccessGateState({
    isSignedInWithGoogle: true,
    hasLocalCustomKey: false,
    hasCloudCustomVault: true,
    isVaultUnlockedInSession: false,
  });
  assert.equal(state.gmailStep, 'enter_password');
  assert.equal(state.recommendedTab, 'gmail');
});

test('resolveAccessGateState recommends Vault Key tab when a local custom-key vault is locked and user is not signed in with Google', () => {
  const state = resolveAccessGateState({
    isSignedInWithGoogle: false,
    hasLocalCustomKey: true,
    hasCloudCustomVault: false,
    isVaultUnlockedInSession: false,
  });
  assert.equal(state.vaultStep, 'unlock_key');
  assert.equal(state.recommendedTab, 'vault');
});

test('validateInsidePasswordSetup and validateVaultKeyInput enforce non-empty key and 6+ char matching password', () => {
  assert.ok(validateInsidePasswordSetup('12345', '12345'));
  assert.ok(validateInsidePasswordSetup('secret12', 'secret99'));
  assert.equal(validateInsidePasswordSetup('secret12', 'secret12'), null);
  assert.ok(validateVaultKeyInput('   '));
  assert.equal(validateVaultKeyInput('my-vault-key'), null);
});
