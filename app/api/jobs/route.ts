import { apiNotFound, nativeRoute } from '../../../server/next/native';
import { jobCreate } from '../../../server/handlers/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiNotFound;
export const POST = nativeRoute(jobCreate);
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
