import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { shortlistToggle } from '../../../../../server/handlers/employers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(shortlistToggle);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
