import { NextRequest, NextResponse } from 'next/server'

const MOBILE_RE = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const override = request.cookies.get('view')?.value  // 'mobile' | 'desktop'
  const ua = request.headers.get('user-agent') ?? ''
  const mobile = override === 'mobile' || (override !== 'desktop' && MOBILE_RE.test(ua))
  const onMobilePath = pathname === '/m' || pathname.startsWith('/m/')

  if (mobile && !onMobilePath) {
    return NextResponse.rewrite(new URL('/m', request.url))
  }
  if (!mobile && onMobilePath) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
