import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ');

/**
 * Determines the correct redirect URI based on:
 * 1. GOOGLE_REDIRECT_URI env var (explicit override — used in production)
 * 2. The incoming request host (dynamic fallback for localhost dev)
 */
function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  // Fallback: derive from request host (works for localhost and any custom domain)
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}/api/drive/callback`;
}

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google Client ID non configurato. Aggiungi GOOGLE_CLIENT_ID al .env.local' },
      { status: 500 }
    );
  }

  const redirectUri = getRedirectUri(request);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Forces new refresh token every time

  return NextResponse.redirect(authUrl.toString());
}
