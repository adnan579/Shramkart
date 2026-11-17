import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { adminStaffUpdate } from '../../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = nativeRoute(adminStaffUpdate);
export const DELETE = apiNotFound;
