import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Instance
 *
 * PENTING: Firebase Admin SDK di Cloudflare Workers memiliki limitasi.
 * Kita hanya akan menggunakan untuk verifikasi token, tidak untuk operasi database.
 *
 * Untuk Cloudflare Workers, kita perlu initialize dengan service account JSON.
 */

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin dengan service account credentials
 *
 * @param serviceAccountJson - Service account JSON dari Firebase Console
 * @returns Firebase Admin App instance
 */
export function initializeFirebaseAdmin(serviceAccountJson: string): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    return firebaseApp;
  } catch (error) {
    throw new Error(`Failed to initialize Firebase Admin: ${error}`);
  }
}

/**
 * Verifikasi Firebase ID Token
 *
 * @param idToken - Firebase ID token dari client
 * @param serviceAccountJson - Service account JSON
 * @returns Decoded token dengan user info
 */
export async function verifyFirebaseToken(idToken: string, serviceAccountJson: string) {
  try {
    const app = initializeFirebaseAdmin(serviceAccountJson);
    const decodedToken = await admin.auth(app).verifyIdToken(idToken);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
  } catch (error) {
    throw new Error(`Token verification failed: ${error}`);
  }
}

/**
 * Ekstrak Bearer token dari Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token string atau null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
