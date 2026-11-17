import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { retentionCheckInHandler } from '../../../server/handlers/community';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(retentionCheckInHandler);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
