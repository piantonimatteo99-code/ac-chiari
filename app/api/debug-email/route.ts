import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdminApp } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const report: Record<string, any> = {};

  // 1. Controlla variabili d'ambiente
  report.env = {
    SMTP_USER: !!process.env.SMTP_USER ? `✅ presente (${process.env.SMTP_USER})` : '❌ MANCANTE',
    SMTP_PASSWORD: !!process.env.SMTP_PASSWORD ? '✅ presente' : '❌ MANCANTE',
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com (default)',
    SMTP_PORT: process.env.SMTP_PORT || '587 (default)',
    FIREBASE_SERVICE_ACCOUNT_KEY: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? `✅ presente (${process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length} chars)`
      : '❌ MANCANTE',
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || '❌ MANCANTE',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ MANCANTE',
  };

  // 2. Prova a inizializzare Firebase Admin
  try {
    initAdminApp();
    report.firebase_admin_init = '✅ OK';
  } catch (e: any) {
    report.firebase_admin_init = `❌ ERRORE: ${e.message}`;
    return NextResponse.json(report);
  }

  // 3. Prova a parsare il service account
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (sa) {
      const cleaned = sa.trim().replace(/^'([\s\S]*)'$/, '$1');
      const parsed = JSON.parse(cleaned);
      report.firebase_sa_parse = {
        status: '✅ JSON valido',
        project_id: parsed.project_id,
        client_email: parsed.client_email,
        private_key_starts: parsed.private_key?.substring(0, 40) + '...',
        private_key_has_newlines: parsed.private_key?.includes('\n') ? '✅ sì' : '⚠️ no (doppio escape?)',
      };
    }
  } catch (e: any) {
    report.firebase_sa_parse = `❌ JSON parse ERRORE: ${e.message}`;
    // non ritorniamo early — continua gli altri test
  }

  // 4. Prova a generare un link di verifica per un'email di test
  try {
    const testEmail = 'test@example.com';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://azionecattolicachiari.vercel.app';
    const link = await admin.auth().generateEmailVerificationLink(testEmail, {
      url: `${baseUrl}/auth/action`,
    });
    report.generate_link = `✅ Link generato (${link.substring(0, 60)}...)`;
  } catch (e: any) {
    report.generate_link = `❌ ERRORE generateEmailVerificationLink: ${e.message}`;
  }

  // 5. Prova connessione SMTP
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    await transporter.verify();
    report.smtp_connection = '✅ Connessione SMTP OK';
  } catch (e: any) {
    report.smtp_connection = `❌ ERRORE SMTP: ${e.message}`;
  }

  return NextResponse.json(report, { status: 200 });
}
