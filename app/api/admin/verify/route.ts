import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { adminVerifyRecord } from '../../../../server/handlers/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(adminVerifyRecord);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
