import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { applicationCreateHandler } from '../../../server/handlers/applications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(applicationCreateHandler);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
