import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { dataExport } from '../../../../server/handlers/dpdp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(dataExport);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
