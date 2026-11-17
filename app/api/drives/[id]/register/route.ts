import { apiNotFound, nativeRoute } from '../../../../../server/next/native';
import { driveRegister } from '../../../../../server/handlers/community';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(driveRegister);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
