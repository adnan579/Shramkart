import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { bootstrapGet } from '../../../server/handlers/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(bootstrapGet);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
