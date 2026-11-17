import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { saveOwnProfile } from '../../../../server/handlers/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = nativeRoute(saveOwnProfile);
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
