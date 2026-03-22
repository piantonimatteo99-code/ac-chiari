import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}/api/calendar/callback`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const userId = searchParams.get('state'); // User ID passed via state param

  if (error) {
    return NextResponse.redirect(new URL(`/calendario?calendar_error=${error}`, request.url));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/calendario?calendar_error=no_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(request),
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Save tokens to Firestore per-user (not globally)
    initAdminApp();
    const db = getFirestore();
    await db.collection('users').doc(userId).collection('private').doc('google-calendar').set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      updatedAt: new Date(),
      connected: true,
    }, { merge: true });

    return NextResponse.redirect(new URL('/calendario?calendar_connected=true', request.url));
  } catch (err: any) {
    console.error('Calendar OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/calendario?calendar_error=${encodeURIComponent(err.message)}`, request.url)
    );
  }
}
