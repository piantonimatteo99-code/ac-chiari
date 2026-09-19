import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import { syncFutureEventsForUser } from '@/lib/google-calendar-utils';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}/api/calendar/callback`;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const userId = searchParams.get('state'); // User ID passed via state param

  if (error) {
    return NextResponse.redirect(new URL(`/calendario?calendar_error=${error}`, BASE_URL));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/calendario?calendar_error=no_code', BASE_URL));
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

    // Mirror connection status to top-level collection for broadcast queries
    // Smart defaults: on first connection, use the user's personal groupId if available
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const userGroupId: string | undefined = userData.groupId;

    const existingSub = await db.collection('calendarSubscriptions').doc(userId).get();
    const isFirstConnection = !existingSub.exists || !(existingSub.data()?.syncGroupIds?.length);

    // First connection → default to user's group; subsequent connections → preserve existing choice
    const defaultSyncGroupIds: string[] = isFirstConnection && userGroupId
      ? [userGroupId]
      : (existingSub.data()?.syncGroupIds ?? []);

    await db.collection('calendarSubscriptions').doc(userId).set({
      uid: userId,
      connected: true,
      syncGroupIds: defaultSyncGroupIds,
    }, { merge: true });

    // Keep private doc consistent (used by sync-settings GET for the UI)
    await db.collection('users').doc(userId).collection('private').doc('google-calendar').set(
      { syncGroupIds: defaultSyncGroupIds },
      { merge: true }
    );

    // On first connection with groups to sync, push all future events immediately
    // Awaited before redirecting so GCal is up-to-date when the user lands back on /calendario
    if (isFirstConnection && defaultSyncGroupIds.length > 0) {
      try {
        const syncResult = await syncFutureEventsForUser(userId, defaultSyncGroupIds);
        console.log(`[calendar/callback] Initial sync for ${userId}: pushed=${syncResult.pushed}, errors=${syncResult.errors.length}`);
      } catch (syncErr) {
        // Non-blocking: a sync failure must not prevent the user from connecting
        console.warn('[calendar/callback] Initial sync failed (non-blocking):', syncErr);
      }
    }

    return NextResponse.redirect(new URL('/calendario?calendar_connected=true', BASE_URL));
  } catch (err: any) {
    console.error('Calendar OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/calendario?calendar_error=${encodeURIComponent(err.message)}`, BASE_URL)
    );
  }
}
