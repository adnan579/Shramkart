import { HttpError } from '../../../server/lib/errors';
import { nativeRoute } from '../../../server/next/native';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Anything under /api that no route file claims. It still goes through the shared checks first (rate limit,
// same-origin for writes), so an unknown path answers exactly like the routes do.
const unknown = nativeRoute(async () => {
  throw new HttpError(404, 'Not found.');
});

export const GET = unknown;
export const POST = unknown;
export const PUT = unknown;
export const PATCH = unknown;
export const DELETE = unknown;
