import { authClient } from './auth-client';

/** Whether this browser can use passkeys at all. */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/** WebAuthn errors that just mean the person closed the Face ID / passkey sheet. */
const CANCELLED = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  // NotAllowedError: dismissed, timed out, or no passkey picked.
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
]);

export function wasCancelled(error: object | null | undefined): boolean {
  return Boolean(error && 'code' in error && CANCELLED.has(String(error.code)));
}

/**
 * Signs in with a passkey. With `autoFill`, waits for the person to pick a
 * passkey from the email field's suggestions instead of opening the sheet.
 * Returns an error message, or null when signed in or cancelled.
 */
export async function signInWithPasskey(autoFill = false): Promise<{ signedIn: boolean; error: string | null }> {
  const { data, error } = await authClient.signIn.passkey({ autoFill });
  if (data && !error) return { signedIn: true, error: null };
  if (wasCancelled(error)) return { signedIn: false, error: null };
  return { signedIn: false, error: error?.message || 'Passkey sign-in failed. Try again.' };
}

/** A label for a new passkey, so the list in Settings says where it lives. */
export function deviceLabel(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  return 'Passkey';
}
