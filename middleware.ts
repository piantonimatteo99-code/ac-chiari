import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantFromHostname, DEFAULT_TENANT_ID, TENANTS } from '@/lib/tenants';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ignora le richieste per asset statici, API interne che non richiedono tenant, e risorse next
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/reset-test-data') ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next();
  }

  // 1. Riconoscimento tramite Hostname
  const hostname = request.headers.get('host');
  let tenant = getTenantFromHostname(hostname);

  // 2. Override tramite Query Parameter (utile in sviluppo locale: ?tenant=acbrescia)
  const tenantParam = searchParams.get('tenant');
  if (tenantParam && TENANTS[tenantParam.toLowerCase()]) {
    const targetTenantId = tenantParam.toLowerCase();
    const response = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies.set('tenant_id', targetTenantId, { path: '/' });
    return response;
  }

  // 3. Verifica eventuale cookie esistente
  const tenantCookie = request.cookies.get('tenant_id')?.value;
  let tenantId = tenant.id;

  if (tenantCookie && TENANTS[tenantCookie]) {
    // Se c'è un cookie valido, lo usiamo come override (specialmente su localhost)
    if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1')) {
      tenantId = tenantCookie;
    }
  }

  // 4. Propaga il tenantId tramite un header personalizzato nella richiesta
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Salva l'informazione nel cookie per future richieste client-side se non è già impostata
  if (tenantCookie !== tenantId) {
    response.cookies.set('tenant_id', tenantId, { path: '/' });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) -> we actually DO want to match api routes so they get x-tenant-id!
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
