import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
].join(' ');

function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  }
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}/api/calendar/callback`;
}

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google Client ID non configurato.' },
      { status: 500 }
    );
  }

  // We pass the userId via query param so the callback knows which user to store tokens for
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId richiesto' }, { status: 400 });
  }

  const redirectUri = getRedirectUri(request);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', CALENDAR_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  // 'consent' is required to always receive a refresh_token from Google.
  // Without it, subsequent authorizations won't return a refresh_token,
  // causing silent failures. The "unverified app" warning is resolved by
  // the Google verification process, not by this parameter.
  authUrl.searchParams.set('prompt', 'consent');
  // Pass userId in state so the callback can retrieve it
  authUrl.searchParams.set('state', userId);

  return NextResponse.redirect(authUrl.toString());
}
