import { createMiddleware } from 'hono/factory';
import { auth } from './index';

/**
 * Middleware untuk inject Better Auth instance ke context
 *
 * Usage:
 * ```typescript
 * app.use('*', authMiddleware)
 *
 * app.get('/protected', async (c) => {
 *   const session = await c.get('auth').api.getSession({
 *     headers: c.req.raw.headers
 *   })
 *
 *   if (!session) {
 *     return c.json({ error: 'Unauthorized' }, 401)
 *   }
 *
 *   return c.json({ user: session.user })
 * })
 * ```
 */
export const authMiddleware = createMiddleware<{ Bindings: CloudflareBindings; Variables: { auth: ReturnType<typeof auth> } }>(
  async (c, next) => {
    const authInstance = auth(c.env);
    c.set('auth', authInstance);
    await next();
  }
);

/**
 * Middleware untuk protect routes yang memerlukan authentication
 *
 * Usage:
 * ```typescript
 * app.get('/protected', requireAuth, async (c) => {
 *   const user = c.get('user')
 *   return c.json({ message: `Hello ${user.name}` })
 * })
 * ```
 */
export const requireAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: { auth: ReturnType<typeof auth>; user: any; session: any };
}>(async (c, next) => {
  const authInstance = c.get('auth');

  if (!authInstance) {
    return c.json({ error: 'Auth not initialized' }, 500);
  }

  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', session.user);
  c.set('session', session.session);

  await next();
});
