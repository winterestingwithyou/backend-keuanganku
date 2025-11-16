import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/better-auth'
import { authMiddleware, requireAuth } from './lib/better-auth/middleware'

const app = new Hono<{ Bindings: CloudflareBindings }>()

// CORS middleware
app.use('*', (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.TRUSTED_ORIGINS.split(","),
    credentials: true,
  })

  return corsMiddleware(c, next);
})

// Auth middleware - inject auth instance ke context
app.use('*', authMiddleware)

// Better Auth routes - handle semua authentication endpoints
app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  const authInstance = auth(c.env)
  return authInstance.handler(c.req.raw)
})

// Public routes
app.get('/', (c) => {
  return c.json({
    message: 'Keuanganku API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      protected: '/api/protected'
    }
  })
})

// Protected routes example
app.get('/api/protected', requireAuth, async (c) => {
  const user = c.get('user')
  return c.json({
    message: 'This is a protected route',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    }
  })
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
