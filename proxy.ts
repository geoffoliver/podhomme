import { NextRequest, NextResponse } from 'next/server'
import { computeAuthToken } from '@/lib/authToken'

const MOBILE_RE = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i

function isPublic(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')        // static files: sw.js, icons, images, etc.
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isPublic(pathname)) {
    const appPassword = process.env.APP_PASSWORD
    if (appPassword) {
      const expected = await computeAuthToken(appPassword)
      const token = request.cookies.get('ph_auth')?.value
      if (token !== expected) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
  }

  // Mobile routing
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/login' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const override = request.cookies.get('view')?.value
  const ua = request.headers.get('user-agent') ?? ''
  const mobile = override === 'mobile' || (override !== 'desktop' && MOBILE_RE.test(ua))
  const onMobilePath = pathname === '/m' || pathname.startsWith('/m/')

  if (mobile && !onMobilePath) return NextResponse.rewrite(new URL('/m', request.url))
  if (!mobile && onMobilePath) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
