import { NextRequest, NextResponse } from 'next/server'

export function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode')
  if (mode !== 'desktop' && mode !== 'mobile') {
    return new Response('Invalid mode', { status: 400 })
  }
  const target = mode === 'desktop' ? '/' : '/m'
  const response = NextResponse.redirect(new URL(target, request.url))
  response.cookies.set('view', mode, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}
