import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Simple check for demo purposes. 
  // In a real scenario, use Firebase Admin or a shared cookie.
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/developer')) {
    // If no session is found, redirect to login (placeholder home for now)
    // Note: This is client-side heavily in this architecture, 
    // so we mostly rely on client context, but middleware handles simple routes.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/developer/:path*'],
};
