import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { offerCreateHandler } from '../../../server/handlers/offers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(offerCreateHandler);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
