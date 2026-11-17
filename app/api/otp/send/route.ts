import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { otpSend } from '../../../../server/handlers/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(otpSend);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
