export function formatFirebaseAuthError(
  error: unknown,
  currentHostname?: string,
): string {
  const host = currentHostname?.trim() || 'this domain';
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown authentication error';

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  const combined = `${code} ${rawMessage}`.toLowerCase();

  if (combined.includes('auth/unauthorized-domain')) {
    return `Domain "${host}" is not authorized for Google Sign-In in Firebase Authentication yet. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains, then try again.`;
  }

  if (combined.includes('auth/popup-blocked')) {
    return 'Google Sign-In popup was blocked by your browser. Please allow popups for this site in browser settings and click Sign in again.';
  }

  if (combined.includes('auth/popup-closed-by-user')) {
    return 'Google Sign-In window was closed before finishing. Complete sign-in and allow read-only Gmail access to connect.';
  }

  if (combined.includes('auth/cancelled-popup-request')) {
    return 'Another Google Sign-In popup is already active. Finish or close it, then try again.';
  }

  if (combined.includes('auth/operation-not-allowed')) {
    return 'Google Sign-In provider is disabled in Firebase Authentication for this project.';
  }

  if (combined.includes('auth/network-request-failed')) {
    return 'Network error while reaching Google Sign-In. Check your internet connection and try again.';
  }

  if (combined.includes('access_denied')) {
    return 'Gmail permission was denied on the Google consent screen. Click Sign in again and grant read-only Gmail access.';
  }

  return `Google Sign-In failed: ${rawMessage}`;
}

export function formatGmailApiError(status: number, bodyText: string): string {
  let detail = bodyText.slice(0, 180);
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; status?: string };
    };
    if (parsed?.error?.message) {
      detail = parsed.error.message;
    }
  } catch {
    // Plain text response fallback
  }

  const lower = detail.toLowerCase();

  if (status === 401) {
    return 'Gmail authorization token expired or became invalid (401). Click "Re-authorize Gmail Access" and complete the consent popup.';
  }

  if (
    status === 403 &&
    (lower.includes('insufficient') || lower.includes('scope'))
  ) {
    return 'Gmail read-only permission was not checked on the Google consent screen. Click "Re-authorize Gmail Access" and check the Gmail permission box.';
  }

  if (status === 403 && lower.includes('has not been used in project')) {
    return 'The Gmail API is not enabled on this Google Cloud project yet. Enable Gmail API in Google Cloud Console for this project and retry.';
  }

  if (status === 403) {
    return `Gmail access denied (403): ${detail}`;
  }

  return `Gmail API error (${status}): ${detail}`;
}
