import webpush from 'web-push';

let isInitialized = false;

export function getWebpush() {
  if (!isInitialized) {
    const subject = process.env.WEBPUSH_SUBJECT;
    const publicKey = process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY;
    const privateKey = process.env.WEBPUSH_PRIVATE_KEY;

    if (subject && publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isInitialized = true;
    } else {
      console.warn('[webpush] VAPID details are not fully configured in environment variables. Lazy initialization skipped.');
    }
  }
  return webpush;
}
