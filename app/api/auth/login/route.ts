import { NextResponse } from 'next/server';
import { computeAuthToken } from '@/lib/authToken';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const { password } = await request.json();
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword || password !== appPassword) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = await computeAuthToken(appPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('ph_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_YEAR,
    path: '/',
  });
  return response;
}
