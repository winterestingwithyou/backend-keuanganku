import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/better-auth'
import { authMiddleware, requireAuth } from './lib/better-auth/middleware'

// Import routes
import walletRoutes from './routes/wallet'
import transactionRoutes from './routes/transaction'
import transferRoutes from './routes/transfer'
import categoryRoutes from './routes/categories'
import dashboardRoutes from './routes/dashboard'
import statisticsRoutes from './routes/statistics'

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
app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  const authInstance = auth(c.env)
  return authInstance.handler(c.req.raw)
})

// Public routes
app.get('/', (c) => {
  return c.json({
    message: 'Keuanganku API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/**',
      wallet: '/api/wallet',
      transaction: '/api/transaction',
      transfer: '/api/transfer',
      categories: '/api/categories',
      dashboard: '/api/dashboard',
      statistics: '/api/statistics/**'
    }
  })
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
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

// Mount API routes
app.route('/api/wallet', walletRoutes)
app.route('/api/transaction', transactionRoutes)
app.route('/api/transfer', transferRoutes)
app.route('/api/categories', categoryRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/statistics', statisticsRoutes)

export default app

app.routes.forEach((route) => {
  console.log(`Registered route: [${route.method}] ${route.path}`);
});