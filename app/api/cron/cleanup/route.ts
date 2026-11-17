import { nativeRoute } from '../../../../server/next/native';
import { cronCleanup } from '../../../../server/handlers/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = nativeRoute(cronCleanup);
export const POST = nativeRoute(cronCleanup);
export const PUT = nativeRoute(cronCleanup);
export const PATCH = nativeRoute(cronCleanup);
export const DELETE = nativeRoute(cronCleanup);
