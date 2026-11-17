import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthContext } from '../types.ts';
import { COOKIE_NAME, loadAuth } from '../auth/session.ts';
import { buildBootstrap } from '../services/bootstrap.ts';
import { getServerContext } from '../runtime.ts';

/**
 * What a server page or layout knows about the request. `cache()` makes each of these run once per request, so the
 * root layout and the page can both ask for them without a second database round trip.
 */

/** The signed-in worker or factory member for this request, or undefined. */
export const pageAuth = cache(async (): Promise<AuthContext | undefined> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return undefined;
  return (await loadAuth(await getServerContext(), token)) ?? undefined;
});

/**
 * What the shared layout hands to the browser so the first paint is useful: the public snapshot every visitor may see
 * (open jobs, hiring drives, counts), plus who is signed in (role and ids only).
 *
 * A signed-in person's private data (candidates, applications, contact numbers, credits) is deliberately NOT put in
 * the page HTML. The browser fetches it from `/api/bootstrap`, so no page that is crawlable or cacheable ever
 * carries it. If the database is unavailable the layout still renders, and the browser asks again.
 */
export const pageSeed = cache(async () => {
  try {
    const ctx = await getServerContext();
    const auth = await pageAuth();
    const snapshot = await buildBootstrap(ctx, undefined);
    const session = auth ? { role: auth.role, workerId: auth.workerId, employerId: auth.employerId } : null;
    return { snapshot, session };
  } catch (error) {
    console.error('[page-seed]', error instanceof Error ? error.message : error);
    return undefined;
  }
});

/** Sends anyone who is not signed in as `role` to the login screen, then back to `pathname` afterwards. */
export async function requirePageRole(role: 'worker' | 'employer', pathname: string, query: Record<string, string | string[] | undefined> = {}) {
  const auth = await pageAuth().catch(() => undefined);
  if (auth?.role === role) return auth;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') search.set(key, value);
    else for (const item of value ?? []) search.append(key, item);
  }
  const next = `${pathname}${search.size ? `?${search.toString()}` : ''}`;
  redirect(`/login?role=${role}&next=${encodeURIComponent(next)}`);
}
