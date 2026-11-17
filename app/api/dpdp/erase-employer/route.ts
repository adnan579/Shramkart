import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { employerErase } from '../../../../server/handlers/dpdp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = nativeRoute(employerErase);
