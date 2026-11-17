import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminChangePassword } from '../../../../server/handlers/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(adminChangePassword);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
