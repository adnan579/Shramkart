import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { creditsConfirm } from '../../../../server/handlers/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(creditsConfirm);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
