/**
 * Set-Cookie strings for the native route handlers. The attribute order and format match what Express
 * produced (`Max-Age`, `Path`, `Expires`, `HttpOnly`, `Secure`, `SameSite`), so browsers and tests see the same cookie.
 */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  /** Lifetime in seconds. */
  maxAgeSec?: number;
}

const SAME_SITE = { lax: 'Lax', strict: 'Strict', none: 'None' } as const;

export function serializeCookie(name: string, value: string, o: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (o.maxAgeSec !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAgeSec)}`);
  parts.push(`Path=${o.path ?? '/'}`);
  if (o.maxAgeSec !== undefined) parts.push(`Expires=${new Date(Date.now() + o.maxAgeSec * 1000).toUTCString()}`);
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  if (o.sameSite) parts.push(`SameSite=${SAME_SITE[o.sameSite]}`);
  return parts.join('; ');
}

/** A cookie the browser deletes straight away (empty value, expiry in 1970). */
export function clearCookie(name: string, o: Omit<CookieOptions, 'maxAgeSec'> = {}): string {
  const parts = [`${name}=`, `Path=${o.path ?? '/'}`, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  if (o.sameSite) parts.push(`SameSite=${SAME_SITE[o.sameSite]}`);
  return parts.join('; ');
}
