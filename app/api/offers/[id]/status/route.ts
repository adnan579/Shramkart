import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { offerStatusHandler } from '../../../../../server/handlers/offers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = nativeRoute(offerStatusHandler);
export const DELETE = apiNotFound;
