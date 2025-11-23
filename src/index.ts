import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireFirebaseAuth } from './lib/firebase/middleware'

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

// Public routes
app.get('/', (c) => {
  return c.json({
    message: 'Keuanganku API - Firebase Auth Edition',
    version: '2.0.0',
    auth: 'Firebase Auth (handled by frontend - Kodular)',
    note: 'User management ditangani oleh Firebase Auth. Backend hanya fokus data keuangan.',
    endpoints: {
      wallet: '/api/wallet',
      transaction: '/api/transaction',
      transfer: '/api/transfer',
      categories: '/api/categories',
      dashboard: '/api/dashboard',
      statistics: '/api/statistics/**'
    },
    kodularFlow: {
      1: 'User login via Firebase Auth component',
      2: 'Call Get Id Token method',
      3: 'On Got Id Token event → save token to TinyDB',
      4: 'Use token for all API calls (Header: Authorization: Bearer <token>)'
    },
    tokenFormat: 'Authorization: Bearer <FIREBASE_ID_TOKEN>'
  })
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
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