import { AsyncLocalStorage } from 'node:async_hooks';
import { loadConfig } from './config.ts';
import { formatFindings, reviewConfig } from './lib/doctor.ts';
import { createDb, migrate, type Db } from './db.ts';
import type { AppContext } from './types.ts';

let contextPromise: Promise<AppContext> | undefined;

/**
 * Tests run a request inside `contextOverride.run(ctx, ...)` so routes and pages use that context (its own database
 * connection, its own fake services) instead of the shared one built from environment variables. Never set in production.
 */
export const contextOverride = new AsyncLocalStorage<AppContext>();

async function initialize(): Promise<AppContext> {
  let stage = 'config';
  let db: Db | undefined;
  try {
    const config = loadConfig();
    if (config.isProd) {
      const notes = reviewConfig(config).filter((finding) => finding.level !== 'ok');
      if (notes.length) console.warn('[config]\n' + formatFindings(notes));
    }
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not set. Add your Postgres connection string to the environment variables.');
    stage = 'database';
    db = createDb(config.databaseUrl);
    await db.query('SELECT 1');
    stage = 'migrations';
    if (process.env.AUTO_MIGRATE !== 'false') await migrate(db);
    return { db, config, deps: { fetch: globalThis.fetch, now: () => new Date() } };
  } catch (error) {
    await db?.close();
    const failure = error instanceof Error ? error : new Error(String(error));
    Object.assign(failure, { startupStage: stage });
    throw failure;
  }
}

export function getServerContext(): Promise<AppContext> {
  const injected = contextOverride.getStore();
  if (injected) return Promise.resolve(injected);
  contextPromise ??= initialize().catch((error) => {
    contextPromise = undefined;
    throw error;
  });
  return contextPromise;
}

/** Which start-up step failed, safe to show (never secrets). Open /api/health to read it. */
export function describeStartupFailure(err: any, fallbackStage = 'config') {
  const stage: string = err?.startupStage ?? fallbackStage;
  return {
    stage,
    code: typeof err?.code === 'string' ? err.code : undefined,
    // Only schema/migration/config problems carry a readable detail; connection errors may name the database user.
    detail: stage === 'migrations' || stage === 'config' ? String(err?.message ?? '').replace(/postgres(ql)?:\/\/\S+/gi, '[url]').slice(0, 240) : undefined,
  };
}
