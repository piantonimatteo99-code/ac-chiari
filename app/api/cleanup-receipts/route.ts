import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    initAdminApp();

    const storageBucketId = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = admin.storage().bucket(storageBucketId);
    const cutoff = new Date(Date.now() - TWO_DAYS_MS);

    // Find all payments that are verified and not yet cleaned up
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('isVerified', '==', true)
      .where('receiptDeleted', '==', false)
      .get();

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const payDoc of paymentsSnap.docs) {
      const data = payDoc.data();
      const verifiedAt: FirebaseFirestore.Timestamp | undefined = data.verifiedAt;

      if (!verifiedAt) { skipped++; continue; }

      const verifiedDate = verifiedAt.toDate ? verifiedAt.toDate() : new Date(verifiedAt as any);
      if (verifiedDate > cutoff) { skipped++; continue; }

      const receiptUrl: string | undefined = data.receiptUrl;
      if (!receiptUrl) {
        // No receipt URL, just mark as deleted
        await payDoc.ref.update({ receiptDeleted: true });
        deleted++;
        continue;
      }

      // Skip Google Drive links — only delete Firebase Storage files
      if (receiptUrl.includes('drive.google.com') || receiptUrl.includes('docs.google.com')) {
        await payDoc.ref.update({ receiptDeleted: true });
        skipped++;
        continue;
      }

      // Extract storage path from Firebase Storage URL
      // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?...
      try {
        const urlObj = new URL(receiptUrl);
        const pathEncoded = urlObj.pathname.split('/o/')[1];
        if (!pathEncoded) { skipped++; continue; }

        const storagePath = decodeURIComponent(pathEncoded.split('?')[0]);
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();

        if (exists) {
          await file.delete();
          console.log(`Deleted receipt: ${storagePath}`);
        }

        await payDoc.ref.update({
          receiptDeleted: true,
          receiptDeletedAt: new Date(),
          receiptUrl: null,
        });
        deleted++;
      } catch (err: any) {
        console.error(`Error deleting receipt for payment ${payDoc.id}:`, err);
        errors.push(`${payDoc.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Cleanup receipts error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
