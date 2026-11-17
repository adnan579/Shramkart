import { apiNotFound, nativeRoute } from '../../../../../../server/next/native';
import { adminStaffResetAuthenticator } from '../../../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(adminStaffResetAuthenticator);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
