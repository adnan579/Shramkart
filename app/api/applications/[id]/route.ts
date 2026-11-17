import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { applicationPatchHandler } from '../../../../server/handlers/applications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = nativeRoute(applicationPatchHandler);
export const DELETE = apiNotFound;
