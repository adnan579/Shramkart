import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { sessionsList } from '../../../server/handlers/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(sessionsList);
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
