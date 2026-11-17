import type { AppContext, AuthContext } from '../types.ts';
import type { NativeContext, NativeResult } from '../next/native.ts';
import { json } from '../next/native.ts';
import { buildBootstrap } from '../services/bootstrap.ts';

/** The body of a mutation response: the caller's fresh, role-scoped snapshot plus any extra keys. */
export async function snapshotWith(ctx: AppContext, auth: AuthContext | undefined, extra: Record<string, unknown> = {}) {
  return { ...(await buildBootstrap(ctx, auth)), ...extra };
}

/** Mutations answer with the caller's fresh, role-scoped snapshot plus any extra keys. */
export async function respond(c: Pick<NativeContext, 'ctx' | 'auth'>, extra: Record<string, unknown> = {}, status = 200): Promise<NativeResult> {
  return json(await snapshotWith(c.ctx, c.auth, extra), { status });
}
