import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // If already authenticated, block access to auth pages
    if (token && (pathname === '/login' || pathname === '/register')) {
      const target = token.role === 'admin' ? '/admin/dashboard' : '/dashboard';
      return NextResponse.redirect(new URL(target, req.url));
    }

    // Admin routes protection
    if (pathname.startsWith('/admin')) {
      if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
      
      if (token.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    // Regular user dashboard protection
    if (pathname.startsWith('/dashboard')) {
      if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow public routes
        if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register')) {
          return true;
        }
        
        // Admin routes require admin role
        if (pathname.startsWith('/admin')) {
          return token?.role === 'admin';
        }
        
        // Dashboard routes require any authenticated user
        if (pathname.startsWith('/dashboard')) {
          return !!token;
        }
        
        // API routes are handled separately
        if (pathname.startsWith('/api')) {
          return true;
        }
        
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/admin/:path*'
  ]
};