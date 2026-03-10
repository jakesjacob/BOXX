import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const memberRoutes = ['/dashboard', '/book', '/profile', '/buy-classes', '/my-bookings', '/confirmation']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Check member routes
  const isProtected = memberRoutes.some((r) => pathname.startsWith(r))
  if (isProtected && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Check admin routes — allow admin and employee roles
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = session.user.role
    if (role !== 'admin' && role !== 'employee') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Employee restrictions — block admin-only pages
    if (role === 'employee') {
      const adminOnlyPaths = ['/admin/settings', '/admin/packs']
      if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
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
