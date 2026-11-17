import { NextRequest, NextResponse } from 'next/server';
import { apiHeaders, isSameOrigin, MUTATING_METHODS } from './server/lib/security-headers';

/**
 * API requests: the first line of defence against cross-site writes. A browser write that names another site in its
 * Origin header is refused here, before any route code runs. (`nativeRoute` repeats the check, so a route is still
 * safe if this file is ever bypassed.) Calls with no Origin (Razorpay's webhook, cron, curl) pass through.
 */
function guardApi(request: NextRequest): NextResponse {
  if (MUTATING_METHODS.has(request.method) && !isSameOrigin(request.headers.get('origin'), request.headers.get('host'), process.env.APP_URL)) {
    return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403, headers: apiHeaders(process.env.NODE_ENV === 'production') });
  }
  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return guardApi(request);
  const isAdmin = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  if (process.env.NODE_ENV !== 'production') {
    const response = NextResponse.next();
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    if (isAdmin) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      response.headers.set('Cache-Control', 'no-store');
    }
    return response;
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://checkout.razorpay.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://lumberjack.razorpay.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);
  requestHeaders.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  if (isAdmin) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)'],
};