import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminAudit } from '../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(adminAudit);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
