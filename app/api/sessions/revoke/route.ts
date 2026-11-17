import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { sessionsRevoke } from '../../../../server/handlers/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(sessionsRevoke);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
