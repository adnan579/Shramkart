import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { grievanceCreate } from '../../../../server/handlers/dpdp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(grievanceCreate);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
