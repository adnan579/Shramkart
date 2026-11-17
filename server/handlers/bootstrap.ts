import { json, type NativeHandler } from '../next/native.ts';
import { buildBootstrap } from '../services/bootstrap.ts';

export const bootstrapGet: NativeHandler = async ({ ctx, auth }) => json(await buildBootstrap(ctx, auth), { headers: { 'cache-control': 'no-store' } });
