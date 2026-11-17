import type { AppContext } from '../../server/types.ts';
import { contextOverride } from '../../server/runtime.ts';

/**
 * An in-process HTTP client for the API, in the shape of supertest (`request(app).get(url).set().send()`, and
 * `request.agent(app)` with a cookie jar). It calls the real `app/api/**\/route.ts` files, so tests exercise exactly
 * what Next serves. Each call runs inside `contextOverride.run(ctx, ...)`, which is how a test supplies its own
 * database and fake services.
 */

type RouteHandler = (request: Request, route?: { params?: Promise<Record<string, string | string[]>> }) => Promise<Response>;
type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RouteHandler>>;

const modules = import.meta.glob('../../app/api/**/route.ts', { eager: true }) as Record<string, RouteModule>;

interface Route {
  segments: string[];
  module: RouteModule;
  fallback: boolean;
}

const routes: Route[] = Object.entries(modules).map(([file, module]) => {
  const path = file.replace('../../app/api/', '').replace(/\/?route\.ts$/, '');
  const segments = path === '' ? [] : path.split('/');
  return { segments, module, fallback: segments.some((s) => s.startsWith('[...')) };
});

/** Every `route.ts` under app/api as `METHOD /api/path/:param`, for the endpoint inventory test. */
export function routeInventory(): string[] {
  const out: string[] = [];
  for (const [file, module] of Object.entries(modules)) {
    const path = '/api/' + file.replace('../../app/api/', '').replace(/\/?route\.ts$/, '');
    const pretty = path.replace(/\/$/, '').replace(/\[\.\.\.(\w+)\]/g, '*').replace(/\[(\w+)\]/g, ':$1');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const handler = module[method];
      if (handler && !handler.name.includes('apiNotFound')) out.push(`${method} ${pretty}`);
    }
  }
  return out.sort();
}

function match(pathname: string): { route: Route; params: Record<string, string> } {
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  let best: { route: Route; params: Record<string, string>; score: number } | undefined;
  for (const route of routes) {
    if (route.fallback) continue;
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let score = 0;
    let ok = true;
    route.segments.forEach((segment, i) => {
      const dynamic = /^\[(\w+)\]$/.exec(segment);
      if (dynamic) params[dynamic[1]!] = parts[i]!;
      else if (segment === parts[i]) score += 1;
      else ok = false;
    });
    if (ok && (!best || score > best.score)) best = { route, params, score };
  }
  if (best) return best;
  const fallback = routes.find((r) => r.fallback)!;
  return { route: fallback, params: { path: parts.join('/') } };
}

export interface NativeApp {
  readonly ctx: AppContext;
}

export function createNativeApp(ctx: AppContext): NativeApp {
  return { ctx };
}

export interface TestResponse {
  status: number;
  /** Parsed JSON, or `{}` for a response that is not JSON (as supertest does). */
  // biome-ignore lint/suspicious/noExplicitAny: tests read fields off the body without casting, as with supertest
  body: any;
  text: string;
  // biome-ignore lint/suspicious/noExplicitAny: a header is a string, or a list of strings for set-cookie
  headers: Record<string, any>;
}

class CookieJar {
  private cookies = new Map<string, string>();
  header(): string | undefined {
    const pairs = [...this.cookies].map(([k, v]) => `${k}=${v}`);
    return pairs.length ? pairs.join('; ') : undefined;
  }
  store(setCookies: string[]) {
    for (const line of setCookies) {
      const [pair, ...attrs] = line.split(';').map((s) => s.trim());
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq);
      const value = pair!.slice(eq + 1);
      const maxAge = attrs.find((a) => /^max-age=/i.test(a));
      const expires = attrs.find((a) => /^expires=/i.test(a));
      const expired = (maxAge && Number(maxAge.split('=')[1]) <= 0) || (expires && Date.parse(expires.split('=')[1]!) <= Date.now());
      if (!value || expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

class Call implements PromiseLike<TestResponse> {
  private headers: Record<string, string> = {};
  private search = new URLSearchParams();
  private payload: unknown;
  private hasPayload = false;

  constructor(private app: NativeApp, private jar: CookieJar | undefined, private method: string, private url: string) {}

  set(name: string | Record<string, string>, value?: string): this {
    if (typeof name === 'string') this.headers[name.toLowerCase()] = value!;
    else for (const [k, v] of Object.entries(name)) this.headers[k.toLowerCase()] = v;
    return this;
  }

  type(value: string): this {
    this.headers['content-type'] = value === 'json' ? 'application/json' : value;
    return this;
  }

  query(q: string | Record<string, unknown>): this {
    if (typeof q === 'string') for (const [k, v] of new URLSearchParams(q)) this.search.append(k, v);
    else for (const [k, v] of Object.entries(q)) if (v !== undefined) this.search.append(k, String(v));
    return this;
  }

  send(body?: unknown): this {
    this.payload = body;
    this.hasPayload = body !== undefined;
    return this;
  }

  private async run(): Promise<TestResponse> {
    const url = new URL(this.url, 'http://localhost');
    for (const [k, v] of this.search) url.searchParams.append(k, v);
    const headers = new Headers({ host: 'localhost', ...this.headers });
    let body: BodyInit | undefined;
    if (this.hasPayload && this.method !== 'GET') {
      if (typeof this.payload === 'string' || Buffer.isBuffer(this.payload)) {
        body = this.payload as BodyInit;
        if (!headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded');
      } else {
        body = JSON.stringify(this.payload);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      }
    }
    if (!headers.has('cookie')) {
      const cookie = this.jar?.header();
      if (cookie) headers.set('cookie', cookie);
    }
    const { route, params } = match(url.pathname);
    const handler = route.module[this.method as keyof RouteModule];
    if (!handler) throw new Error(`No ${this.method} handler for ${url.pathname}`);
    const request = new Request(url, { method: this.method, headers, body });
    const response = await contextOverride.run(this.app.ctx, () => handler(request, { params: Promise.resolve(params) }));
    const text = await response.text();
    // biome-ignore lint/suspicious/noExplicitAny: see TestResponse.headers
    const out: Record<string, any> = {};
    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie') out[name] = value;
    });
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) {
      out['set-cookie'] = setCookies;
      this.jar?.store(setCookies);
    }
    // biome-ignore lint/suspicious/noExplicitAny: see TestResponse.body
    let parsed: any = {};
    if ((out['content-type'] ?? '').includes('json') && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }
    }
    return { status: response.status, body: parsed, text, headers: out };
  }

  // A request is awaited like supertest's, so `await agent.get(url)` runs it. That needs a `then` member.
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable (the supertest-style API the tests use)
  then<A = TestResponse, B = never>(onOk?: ((v: TestResponse) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then(onOk, onErr);
  }
}

export interface Client {
  get(url: string): Call;
  post(url: string): Call;
  put(url: string): Call;
  patch(url: string): Call;
  delete(url: string): Call;
}

function client(app: NativeApp, jar?: CookieJar): Client {
  const make = (method: string) => (url: string) => new Call(app, jar, method, url);
  return { get: make('GET'), post: make('POST'), put: make('PUT'), patch: make('PATCH'), delete: make('DELETE') };
}

/** `request(app)`: one-off calls with no cookies. `request.agent(app)`: calls that keep cookies between them. */
const request = Object.assign((app: NativeApp): Client => client(app), {
  agent: (app: NativeApp): Client => client(app, new CookieJar()),
});

export type Agent = Client;
export default request;
