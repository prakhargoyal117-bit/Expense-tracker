import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInAppBrowserHint,
  formatFirebaseAuthError,
  formatGmailApiError,
  shouldOfferRedirectFallback,
} from './authHelpers';

test('formatFirebaseAuthError maps unauthorized-domain, popup-blocked, and cancelled-popup-request cleanly', () => {
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

  const cancelledMsg = formatFirebaseAuthError(
    { code: 'auth/cancelled-popup-request', message: 'cancelled' },
    'project2-beryl-eta.vercel.app',
  );
  assert.ok(cancelledMsg.includes('Full-Page Redirect Sign-In'));

  const closedMsg = formatFirebaseAuthError({
    code: 'auth/popup-closed-by-user',
    message: 'closed',
  });
  assert.ok(closedMsg.toLowerCase().includes('closed before completing'));
});

test('shouldOfferRedirectFallback and detectInAppBrowserHint detect mobile webview & popup failures', () => {
  assert.equal(
    shouldOfferRedirectFallback({ code: 'auth/cancelled-popup-request' }),
    true,
  );
  assert.equal(
    shouldOfferRedirectFallback({ code: 'auth/popup-blocked' }),
    true,
  );
  assert.equal(
    shouldOfferRedirectFallback({ code: 'auth/unauthorized-domain' }),
    false,
  );

  const hint = detectInAppBrowserHint(
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0 Mobile Safari/537.36 [FBAN/EMA;WhatsApp]',
  );
  assert.ok(hint?.includes('Open in Chrome'));
  assert.equal(
    detectInAppBrowserHint('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'),
    null,
  );
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
