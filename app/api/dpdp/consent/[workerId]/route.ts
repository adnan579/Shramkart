import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { consentUpdate } from '../../../../../server/handlers/dpdp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = nativeRoute(consentUpdate);
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
