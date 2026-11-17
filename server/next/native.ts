import { ZodError } from 'zod';
import type { AppContext, AuthContext } from '../types.ts';
import { HttpError } from '../lib/errors.ts';
import { apiHeaders, isSameOrigin, MUTATING_METHODS } from '../lib/security-headers.ts';
import { overApiLimit, TOO_MANY } from '../lib/api-limit.ts';
import { invalidate } from '../lib/ttl-cache.ts';
import { reportError, reporterFromEnv, reporterOf } from '../lib/monitoring.ts';
import { ADMIN_COOKIE, COOKIE_NAME, loadAdminAuth, loadAuth, parseCookies } from '../auth/session.ts';
import { ensureBootstrapAdmin } from '../services/adminAccounts.ts';
import { contextOverride, getServerContext } from '../runtime.ts';

/**
 * The API layer. Every `app/api/**\/route.ts` file wraps its handler in `nativeRoute`, which applies the same checks
 * to every endpoint, in this order: rate limit, body size and JSON, same-origin check for writes, session lookup.
 * Handlers then only contain the endpoint's own logic and return a body (or `json(body, { status, cookies })`).
 */

export const JSON_BODY_LIMIT = 200 * 1024;
const EMPTY = Buffer.alloc(0);

export interface NativeContext {
  ctx: AppContext;
  request: Request;
  params: Record<string, string>;
  /** The query string of the request URL. */
  query: URLSearchParams;
  /** The signed-in worker or factory member, if any. */
  auth?: AuthContext;
  /** The signed-in staff member (admin console cookie), if any. */
  admin?: AuthContext;
  ip: string;
  /** The parsed JSON body (undefined when there is none). */
  body: unknown;
  /** The body exactly as it arrived. Needed to check webhook signatures, which cover the raw bytes. */
  raw: Buffer;
}

export interface NativeResult {
  status?: number;
  body?: unknown;
  /** A body sent as-is (not JSON), for example CSV. Set the `content-type` header with it. */
  raw?: string;
  headers?: Record<string, string>;
  cookies?: string[];
}

/** Marks a handler's return value as a full response. Anything else a handler returns is the JSON body of a 200. */
export class NativeResponse implements NativeResult {
  constructor(
    public body?: unknown,
    public status = 200,
    public headers?: Record<string, string>,
    public cookies?: string[],
    public raw?: string
  ) {}
}

export function json(body: unknown, init: { status?: number; headers?: Record<string, string>; cookies?: string[] } = {}): NativeResponse {
  return new NativeResponse(body, init.status ?? 200, init.headers, init.cookies);
}

export function text(raw: string, headers: Record<string, string>): NativeResponse {
  return new NativeResponse(undefined, 200, headers, undefined, raw);
}

export type NativeHandler = (c: NativeContext) => Promise<NativeResult | unknown>;
type RouteContext = { params?: Promise<Record<string, string | string[]>> };
type NextHandler = (request: Request, route?: RouteContext) => Promise<Response>;

export interface NativeOptions {
  /** Tests inject a context; production uses the shared one from server/runtime.ts. */
  getContext?: () => Promise<AppContext>;
  /** Public GETs that do not need the session can skip loading it. */
  skipAuth?: boolean;
}

let adminReady: Promise<void> | undefined;
async function defaultContext(): Promise<AppContext> {
  // Tests run a request inside `contextOverride.run(ctx, ...)` to use their own database and fake services.
  const injected = contextOverride.getStore();
  if (injected) return injected;
  const ctx = await getServerContext();
  adminReady ??= ensureBootstrapAdmin(ctx.db, ctx.config).catch((error) => {
    adminReady = undefined;
    throw error;
  });
  await adminReady;
  return ctx;
}

function clientIpOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return (forwarded || '127.0.0.1').replace(/^::ffff:/, '');
}

function reply(ctx: AppContext | undefined, result: NativeResult): Response {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries({ ...apiHeaders(Boolean(ctx?.config.isProd)), ...result.headers })) headers.set(name, value);
  for (const cookie of result.cookies ?? []) headers.append('set-cookie', cookie);
  const status = result.status ?? 200;
  const empty = status === 204 || status === 304;
  const body = result.raw !== undefined ? result.raw : JSON.stringify(result.body ?? {});
  return new Response(empty ? null : body, { status, headers });
}

export const errorBody = (message: string, extra?: Record<string, unknown>) => ({ error: message, ...(extra ?? {}) });

async function readBody(request: Request): Promise<{ raw: Buffer; json: unknown }> {
  const type = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!(type === 'application/json' || type.endsWith('+json'))) return { raw: EMPTY, json: undefined };
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > JSON_BODY_LIMIT) throw new HttpError(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) return { raw: EMPTY, json: undefined };
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > JSON_BODY_LIMIT) {
      await reader.cancel();
      throw new HttpError(413, 'Request too large.');
    }
    chunks.push(Buffer.from(value));
  }
  const raw = Buffer.concat(chunks);
  const text = raw.toString('utf8');
  if (!text.trim()) return { raw, json: undefined };
  try {
    return { raw, json: JSON.parse(text) };
  } catch {
    throw new HttpError(400, 'Malformed JSON.');
  }
}

/** Turns anything a handler throws into the response the browser gets. */
export function errorResult(error: unknown): NativeResult {
  if (error instanceof HttpError) return { status: error.status, body: errorBody(error.message, error.extra) };
  if (error instanceof ZodError) return { status: 400, body: errorBody(error.issues[0]?.message ?? 'Invalid request.') };
  return { status: 500, body: errorBody('Something went wrong on our side. Please try again.') };
}

export function nativeRoute(handler: NativeHandler, options: NativeOptions = {}): NextHandler {
  return async (request, route) => {
    let ctx: AppContext | undefined;
    try {
      ctx = await (options.getContext ?? defaultContext)();
    } catch (error) {
      await reportError(reporterFromEnv(), error, { where: 'startup', method: request.method, path: new URL(request.url).pathname, status: 503, tags: { stage: String((error as { startupStage?: string })?.startupStage ?? 'unknown') } });
      return reply(undefined, { status: 503, body: errorBody('The service is starting up or misconfigured. Please try again shortly.', { stage: (error as { startupStage?: string })?.startupStage }) });
    }

    const t0 = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname;
    let result: NativeResult;
    try {
      // 1. Rate limit, then the body (a blocked caller never costs a parse).
      const ip = clientIpOf(request);
      const limited = await overApiLimit(ctx.db, ip, request.method);
      const body = limited ? { raw: EMPTY, json: undefined } : await readBody(request);
      if (limited) {
        result = { status: 429, body: TOO_MANY };
      } else if (MUTATING_METHODS.has(request.method) && !isSameOrigin(request.headers.get('origin'), request.headers.get('host'), ctx.config.appUrl)) {
        // 3. Browser writes must come from this site.
        result = { status: 403, body: errorBody('Cross-site request blocked.') };
      } else {
        // 4. Session.
        const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
        const auth = options.skipAuth ? undefined : (await loadAuth(ctx, cookies[COOKIE_NAME])) ?? undefined;
        const admin = !options.skipAuth && cookies[ADMIN_COOKIE] ? (await loadAdminAuth(ctx, cookies[ADMIN_COOKIE])) ?? undefined : undefined;
        const raw = (await route?.params) ?? {};
        const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join('/') : v]));
        const out = await handler({ ctx, request, params, query: url.searchParams, auth, admin, ip, body: body.json, raw: body.raw });
        result = out instanceof NativeResponse ? out : { body: out };
      }
    } catch (error) {
      result = errorResult(error);
      if (result.status === 500) await reportError(reporterOf(ctx), error, { where: 'api', method: request.method, path: pathname, status: 500 });
    }
    // After any successful write, drop the cached public job list so this instance never serves it stale.
    if (MUTATING_METHODS.has(request.method) && (result.status ?? 200) < 400) invalidate(ctx);
    // One log line per API call in production: no bodies, no phone numbers, no cookies.
    if (ctx.config.isProd && pathname !== '/api/health') {
      console.log(JSON.stringify({ t: new Date().toISOString(), m: request.method, p: pathname.replace(/^\/api/, ''), s: result.status ?? 200, ms: Date.now() - t0 }));
    }
    return reply(ctx, result);
  };
}

/** What a route file answers for a method it does not handle. */
export const apiNotFound: NextHandler = async () => reply(undefined, { status: 404, body: errorBody('Not found.') });
