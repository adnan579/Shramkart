import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminSessions } from '../../../../server/handlers/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(adminSessions);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
