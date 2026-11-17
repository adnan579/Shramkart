import { apiNotFound, nativeRoute } from '../../../../server/next/native';
import { jobUpdate } from '../../../../server/handlers/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = nativeRoute(jobUpdate);
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
