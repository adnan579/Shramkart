# Next.js Migration Baseline

## Baseline gates

- `npm run lint`: passed on the branch baseline.
- `npm test`: 22 files and 181 tests pass (at the end of Phase 5; it was 14 files and 122 tests at the start).
- `npm run e2e`: the journey passes against `next dev` (the test waits for the `html[data-hydrated]` marker, which the app sets once React is attached and the first session check is done).
- `vite-final` rollback tag: exists on GitHub at commit `5942508`, the last Vite-only `main`.

## Behavior to preserve

- API integration tests call the real `app/api/**/route.ts` files through an in-process client with supertest's shape (`tests/helpers/native-client.ts`, used by `tests/helpers/app.ts`). Each call runs inside `contextOverride`, which gives it the test's database and fake services.
- The user session cookie is `hj_session`, HttpOnly, SameSite=Lax, path `/`, 30-day max age, and Secure in production (`server/auth/session.ts`).
- The session token is hashed in the existing `sessions` table. Do not change the cookie or schema during the page migration.
- The selected language is stored in the `hj_language` cookie; routes stay unprefixed.
- Razorpay webhook validation depends on the raw request bytes (`server/handlers/credits.ts`, reading `raw` from `nativeRoute`).
- Public job data must use `jobView` without the contact option. HR names, phone numbers, and WhatsApp numbers are private (`server/services/serialize.ts`).
- `tests/api-contract-baseline.test.ts` pins the method and path list of every route file under `app/api` (the same inventory the Express routers had). Route tests remain the status/body contract; `tests/api-layer.test.ts` covers the shared checks (rate limit, body size, same-origin, headers); `tests/next-api.test.ts` pins body limits, webhook bytes and session-cookie flags on the route files themselves; `tests/proxy-api-guard.test.ts` covers the write guard in `proxy.ts`.

## Phase 3 status (done)

Every screen is a real route. `app/layout.tsx` is the one root layout (`<html>`, `<body>`, fonts, language). `app/(public)/layout.tsx` adds the data provider, the site shell (header, bottom bar, footer, dialogs, toast) and Vercel Analytics and Speed Insights. The old catch-all page and the 872-line `src/App.tsx` are gone.

| Route | Kind |
| --- | --- |
| `/`, `/about`, `/jobs` (visitors), `/jobs/[id]`, `/employers`, `/login`, `/privacy`, `/terms` | Server pages (login, privacy and terms open a dialog on load) |
| `/jobs` (signed-in worker), `/me`, `/me/applications`, `/me/id-card`, `/me/profile`, `/employers/talent`, `/employers/dashboard` | Client screens behind a server check (`requirePageRole` in `server/next/page-data.ts` redirects to `/login?role=...&next=...`) |
| Anything else | Next.js 404 |

The layout seeds the provider with the **public** snapshot and the signed-in role only. A signed-in person's own data (candidates, applications, contact numbers, credits) is fetched from `/api/bootstrap` and is never written into page HTML; `e2e/journey.spec.ts` checks this on the job page. Moving between `/me` tabs changes the address with `history.pushState` and needs no server request.

## Phase 4 status

The public pages live under `app/(public)`; the staff console lives at `/admin` under `app/(admin)`. Both sit under the root layout. The console keeps its own stylesheet and `lang="en"`, is not linked from public UI code, and its response retains `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## Phase 5 status (done)

Every API endpoint is a route file under `app/api/**/route.ts` wrapped in `nativeRoute`, which applies, in order: rate limit, body size and JSON, same-origin check for writes, session lookup, error mapping, cache invalidation after a successful write. Express, `serverless-http`, `supertest` and their types are removed from `package.json`. `proxy.ts` now also runs for `/api` and refuses a cross-site write before any route code runs; `nativeRoute` repeats the check. Calls with no `Origin` (Razorpay's webhook, cron) pass.
