import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFirebaseAuthError, formatGmailApiError } from './authHelpers';

test('formatFirebaseAuthError maps unauthorized-domain and popup-blocked cleanly', () => {
  const domainMsg = formatFirebaseAuthError(
    { code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' },
    'ais-pre-example.run.app',
  );
  assert.ok(domainMsg.includes('ais-pre-example.run.app'));
  assert.ok(domainMsg.includes('Authorized domains'));

  const popupMsg = formatFirebaseAuthError(
    new Error('Firebase: Error (auth/popup-blocked).'),
    'localhost',
  );
  assert.ok(popupMsg.toLowerCase().includes('popup was blocked'));

  const closedMsg = formatFirebaseAuthError({
    code: 'auth/popup-closed-by-user',
    message: 'closed',
  });
  assert.ok(closedMsg.toLowerCase().includes('closed before finishing'));
});

test('formatGmailApiError surfaces expired tokens and missing Gmail scopes clearly', () => {
  const err401 = formatGmailApiError(401, '{"error":{"message":"Invalid Credentials"}}');
  assert.ok(err401.includes('Re-authorize Gmail Access'));

  const err403Scope = formatGmailApiError(
    403,
    JSON.stringify({
      error: {
        status: 'PERMISSION_DENIED',
        message: 'Request had insufficient authentication scopes.',
      },
    }),
  );
  assert.ok(err403Scope.includes('permission was not checked'));

  const err403Disabled = formatGmailApiError(
    403,
    JSON.stringify({
      error: {
        message: 'Gmail API has not been used in project 123 before or it is disabled.',
      },
    }),
  );
  assert.ok(err403Disabled.includes('Enable Gmail API'));
});
