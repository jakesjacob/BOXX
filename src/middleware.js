import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const memberRoutes = ['/dashboard', '/book', '/profile', '/buy-classes', '/my-bookings', '/confirmation']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Check member routes
  const isProtected = memberRoutes.some((r) => pathname.startsWith(r))
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check admin routes — redirect non-admins to dashboard (don't reveal admin exists)
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    if (session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/book/:path*',
    '/profile/:path*',
    '/buy-classes/:path*',
    '/my-bookings/:path*',
    '/confirmation/:path*',
    '/admin/:path*',
  ],
}
