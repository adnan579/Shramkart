import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminLogout } from '../../../../server/handlers/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(adminLogout);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
