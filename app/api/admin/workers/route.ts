import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminWorkers } from '../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(adminWorkers);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
