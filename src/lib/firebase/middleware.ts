import { createMiddleware } from 'hono/factory';
import { verifyFirebaseToken, extractBearerToken } from './admin';

/**
 * Middleware untuk verifikasi Firebase Auth token
 *
 * Middleware ini:
 * 1. Ekstrak Bearer token dari Authorization header
 * 2. Verifikasi token dengan Firebase Admin SDK
 * 3. Inject user info ke context
 *
 * Usage:
 * ```typescript
 * app.use('/api/*', requireFirebaseAuth)
 *
 * app.get('/api/profile', (c) => {
 *   const user = c.get('firebaseUser')
 *   return c.json({ user })
 * })
 * ```
 */
export const requireFirebaseAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: {
    firebaseUser: {
      uid: string;
      email: string | undefined;
      emailVerified: boolean | undefined;
      name: string | undefined;
      picture: string | undefined;
    };
  };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401);
  }

  try {
    // Verifikasi token dengan Firebase Admin SDK
    const decodedToken = await verifyFirebaseToken(
      token,
      c.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

    // Inject user info ke context
    c.set('firebaseUser', decodedToken);

    await next();
  } catch (error) {
    return c.json(
      {
        error: 'Unauthorized: Invalid or expired token',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      401
    );
  }
});

/**
 * Middleware untuk optional Firebase Auth
 * Tidak akan throw error jika token tidak ada atau invalid,
 * tapi akan inject user info jika token valid.
 *
 * Usage:
 * ```typescript
 * app.use('/api/*', optionalFirebaseAuth)
 *
 * app.get('/api/content', (c) => {
 *   const user = c.get('firebaseUser')
 *   if (user) {
 *     // User logged in
 *     return c.json({ content: 'Premium content', user })
 *   } else {
 *     // Guest user
 *     return c.json({ content: 'Public content' })
 *   }
 * })
 * ```
 */
export const optionalFirebaseAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: {
    firebaseUser?: {
      uid: string;
      email: string | undefined;
      emailVerified: boolean | undefined;
      name: string | undefined;
      picture: string | undefined;
    };
  };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (token) {
    try {
      const decodedToken = await verifyFirebaseToken(
        token,
        c.env.FIREBASE_SERVICE_ACCOUNT_JSON
      );
      c.set('firebaseUser', decodedToken);
    } catch (error) {
      // Ignore error, user will be undefined
      console.warn('Optional auth failed:', error);
    }
  }

  await next();
});
