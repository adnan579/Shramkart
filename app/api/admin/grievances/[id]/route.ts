import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { adminGrievanceUpdate } from '../../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = nativeRoute(adminGrievanceUpdate);
export const DELETE = apiNotFound;
