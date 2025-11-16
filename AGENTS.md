# Personal Finance App - Backend Development Guide

## ✅ Implementation Status: COMPLETE

**Semua fitur telah berhasil diimplementasikan!** Server berjalan tanpa error di `http://localhost:8787`.

Lihat [IMPLEMENTATION.md](./IMPLEMENTATION.md) untuk detail lengkap implementasi dan testing guide.

## Project Overview
Backend untuk aplikasi keuangan pribadi dengan fitur multi-wallet, pencatatan transaksi, transfer antar wallet, dan statistik keuangan. Dibangun dengan Hono.js, Better-Auth, Drizzle ORM, dan Cloudflare D1.

## Tech Stack
- **Framework**: Hono.js
- **Authentication**: Better-Auth (cookie-based sessions)
- **ORM**: Drizzle ORM
- **Database**: Cloudflare D1 (SQLite)
- **Runtime**: Cloudflare Workers

## Database Schema Overview

### Core Tables
1. **user** - Identitas User (managed by Better-Auth)
2. **account** - Akun yang terkait dengan user (managed by Better-Auth)
3. **session** - Data sesi pengguna (managed by Better-Auth)
4. **verification** - verifikasi pengguna (managed by Better-Auth)
5. **wallet** - Tempat pencatatan keuangan user (dana, ovo, gopay, tunai, bank, dll)
6. **transaction** - Catatan transaksi keuangan (pemasukan/pengeluaran)
7. **transfer** - Perpindahan dana antar akun
8. **category** - Kategori transaksi (opsional, untuk filtering)

### Key Relationships
- User → wallet (1:N) - Satu user bisa punya banyak tempat pencatatan
- Wallet → Transactions (1:N) - Satu wallet punya banyak transaksi
- Transfer references 2 wallet (from_wallet & to_wallet)
- Transaction → Category (N:1) - Transaksi bisa dikategorikan

## API Endpoints Structure

### Authentication (Better-Auth)
- POST `/api/auth/sign-up/email` - Register user baru
- POST `/api/auth/sign-in/email` - Login user
- POST `/api/auth/sign-out` - Logout user
- GET `/api/auth/session` - Get current session
- GET `/api/auth/user` - Get user profile
- PATCH `/api/auth/user` - Update user profile

### Wallets Management
- GET `/api/wallet` - List semua wallet user
- POST `/api/wallet` - Buat wallet baru
- GET `/api/wallet/:id` - Detail wallet
- PATCH `/api/wallet/:id` - Update wallet (nama, icon, color, dll)
- DELETE `/api/wallet/:id` - Hapus wallet (soft delete)
- PATCH `/api/wallet/reorder` - Update urutan tampilan wallet

### Transactions
- GET `/api/transaction` - List transaksi (dengan filter & pagination)
  - Query params: `?wallet_id=xxx&type=income|expense&category_id=xxx&start_date=xxx&end_date=xxx&page=1&limit=20`
- POST `/api/transaction` - Buat transaksi baru
- GET `/api/transaction/:id` - Detail transaksi
- PATCH `/api/transaction/:id` - Edit transaksi
- DELETE `/api/transaction/:id` - Hapus transaksi
- GET `/api/transaction/recent` - Transaksi terbaru untuk beranda (limit 10)

### Transfers
- POST `/api/transfer` - Transfer dana antar wallet
- GET `/api/transfer` - List history transfer (dengan pagination)
  - Query params: `?wallet_id=xxx&start_date=xxx&end_date=xxx&page=1&limit=20`
- GET `/api/transfer/:id` - Detail transfer
- DELETE `/api/transfer/:id` - Hapus transfer (rollback balance)

### Statistics & Dashboard
- GET `/api/dashboard` - Summary untuk beranda
  - Response: `{ total_balance, total_income, total_expense, wallet_summary, recent_transaction }`
- GET `/api/statistics/monthly` - Statistik bulanan (income vs expense per bulan)
  - Query params: `?year=2024&months=6`
- GET `/api/statistics/category` - Breakdown per kategori
  - Query params: `?type=income|expense&start_date=xxx&end_date=xxx`
- GET `/api/statistics/wallet` - Balance dan summary per wallet
- GET `/api/statistics/trends` - Trend pemasukan/pengeluaran (untuk grafik)

### Categories
- GET `/api/categories` - List kategori (default + user-created)
- POST `/api/categories` - Buat kategori custom
- PATCH `/api/categories/:id` - Edit kategori (hanya user-created)
- DELETE `/api/categories/:id` - Hapus kategori (hanya user-created)

## Business Logic Guidelines

### Wallet Balance Calculation
- Balance dihitung dari: `initial_balance + SUM(income) - SUM(expense) + transfer_in - transfer_out - transfer_fees`
- `current_balance` di-cache di database untuk performa
- Update balance setiap kali ada transaksi/transfer baru
- Gunakan database transaction untuk konsistensi data

### Transaction Rules
- Type: 'income' atau 'expense'
- Amount harus positive number (> 0)
- Setiap transaksi harus terkait dengan 1 wallet
- Include `transaction_date` untuk tanggal aktual transaksi
- `created_at` untuk audit trail
- Validation: wallet harus milik user yang sedang login
- Setelah create/update/delete transaction → update `wallet.current_balance`

### Transfer Rules
- Transfer melibatkan 2 wallet (from_wallet_id & to_wallet_id)
- Amount dikurangi dari wallet pengirim, ditambah ke wallet penerima
- Tidak boleh transfer ke wallet yang sama (validate: `from_wallet_id !== to_wallet_id`)
- Validasi: balance wallet pengirim harus cukup (`current_balance >= amount + fee`)
- Fee akan dikurangi dari wallet pengirim (opsional, default 0)
- Gunakan database transaction untuk atomic operation
- Update kedua wallet balance setelah transfer

### Wallet Management
- Saat create wallet: set `initial_balance` dan `current_balance` sama
- Soft delete: set `is_active = false`, jangan hapus dari database
- Tidak bisa delete wallet yang masih punya transaksi aktif (atau cascade delete semua transaksi)
- `display_order` untuk custom sorting di UI (user bisa drag & drop)

### Data Validation
- Wallet name: required, max 50 chars, unique per user
- Transaction amount: required, positive number, max 2 decimal places
- Transfer amount: required, positive number, max 2 decimal places
- Dates: ISO 8601 format atau Unix timestamp
- User can only access their own data (authorization check di setiap endpoint)

## Security Considerations
- Semua endpoint (kecuali auth) harus authenticated
- Middleware untuk check session: `requireAuth()`
- Validasi user ownership untuk semua resources:
  - Check `wallet.user_id === session.userId`
  - Check `transaction.user_id === session.userId`
  - Check `transfer.user_id === session.userId`
- Sanitize input untuk prevent SQL injection (handled by Drizzle)
- Rate limiting untuk API endpoints (gunakan Cloudflare rate limiting)
- CORS configuration untuk frontend (Kodular & React Expo)
- Validate amount values untuk prevent negative atau zero values

## CORS Configuration
```typescript
// Untuk Better-Auth cookie-based authentication
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: [
    'http://localhost:8081', // React Expo local dev
    'https://your-expo-app.com', // React Expo production
    'https://your-kodular-app.com' // Kodular app (jika ada custom domain)
  ],
  credentials: true, // PENTING untuk cookie-based auth
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie']
}));
```

## Error Handling Pattern
```typescript
// Error response format
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INSUFFICIENT_BALANCE' | 'INTERNAL_ERROR',
    message: 'Human readable message',
    details?: {
      field?: string,
      constraint?: string,
      // ... additional context
    }
  }
}

// Error codes
- VALIDATION_ERROR: Input validation failed
- NOT_FOUND: Resource tidak ditemukan
- UNAUTHORIZED: User tidak ter-autentikasi atau tidak punya akses
- INSUFFICIENT_BALANCE: Balance wallet tidak cukup untuk transfer
- DUPLICATE_ENTRY: Resource sudah ada (e.g. wallet name duplicate)
- INTERNAL_ERROR: Server error
```

## Success Response Pattern
```typescript
// Single resource
{
  success: true,
  data: {
    id: 'xxx',
    // ... resource fields
  },
  meta?: {
    timestamp: '2024-01-01T00:00:00Z'
  }
}

// List resources
{
  success: true,
  data: [
    { id: 'xxx', ... },
    { id: 'yyy', ... }
  ],
  meta: {
    pagination: {
      page: 1,
      limit: 20,
      total: 150,
      totalPages: 8
    },
    timestamp: '2024-01-01T00:00:00Z'
  }
}

// Dashboard/Statistics
{
  success: true,
  data: {
    summary: { ... },
    wallet: [ ... ],
    recent_transaction: [ ... ]
  }
}
```

## Database Transaction Pattern
```typescript
// Untuk operations yang update multiple tables
// Contoh: Transfer antar wallet

await db.transaction(async (tx) => {
  // 1. Validate from_wallet balance
  const fromWallet = await tx.query.wallet.findFirst({
    where: eq(wallet.id, fromWalletId)
  });
  
  if (fromWallet.currentBalance < amount + fee) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  
  // 2. Create transfer record
  await tx.insert(transfer).values({
    userId,
    fromWalletId,
    toWalletId,
    amount,
    fee,
    transferDate: new Date()
  });
  
  // 3. Update from_wallet balance
  await tx.update(wallet)
    .set({ currentBalance: fromWallet.currentBalance - amount - fee })
    .where(eq(wallet.id, fromWalletId));
  
  // 4. Update to_wallet balance
  await tx.update(wallet)
    .set({ currentBalance: sql`${wallet.currentBalance} + ${amount}` })
    .where(eq(wallet.id, toWalletId));
});
```

## Development Workflow
1. ✅ Setup Drizzle schema sesuai database design (`src/db/schema.ts`)
2. ✅ Generate migrations: `bunx drizzle-kit generate`
3. ✅ Apply migrations: `bunx drizzle-kit migrate`
4. ✅ Implement Better-Auth configuration (`src/lib/better-auth/`)
5. ✅ Create middleware untuk authentication (`src/lib/better-auth/middleware.ts`)
6. ✅ Create API routes dengan validation (`src/routes/`)
7. ✅ Implement helper functions untuk balance calculation (`src/lib/utils.ts`)
8. ⏭️ Test dengan Postman atau curl
9. ⏭️ Deploy ke Cloudflare Workers: `bunx wrangler deploy`

## File Structure
```
src/
├── db/
│   ├── schema.ts          ✅ Drizzle schema definitions with relations
│   ├── auth-schema.ts     ✅ Better-Auth tables
│   ├── types.ts           ✅ TypeScript type definitions
│   └── seed.ts            ✅ Seed data (default categories & wallet)
├── lib/
│   ├── better-auth/       ✅ Better-Auth configuration
│   │   ├── index.ts       ✅ Auth instance factory
│   │   ├── options.ts     ✅ Auth options
│   │   └── middleware.ts  ✅ Auth & requireAuth middleware
│   └── utils.ts           ✅ Helper functions
├── validators/
│   ├── wallet.ts          ✅ Wallet validation schemas (Zod)
│   ├── transaction.ts     ✅ Transaction validation schemas (Zod)
│   ├── transfer.ts        ✅ Transfer validation schemas (Zod)
│   └── category.ts        ✅ Category validation schemas (Zod)
├── routes/
│   ├── wallet.ts          ✅ Wallet management endpoints
│   ├── transaction.ts     ✅ Transaction endpoints
│   ├── transfer.ts        ✅ Transfer endpoints
│   ├── categories.ts      ✅ Category endpoints
│   ├── dashboard.ts       ✅ Dashboard/summary endpoints
│   └── statistics.ts      ✅ Statistics endpoints
└── index.ts               ✅ Main app entry point with all routes
```

## Testing Checklist
- ⏭️ User registration & login works
- ⏭️ Session management & cookies work with CORS
- ⏭️ CRUD operations untuk wallet
- ⏭️ CRUD operations untuk transaction
- ⏭️ Transaction updates wallet balance correctly
- ⏭️ Transfer logic works correctly (atomic)
- ⏭️ Transfer validates sufficient balance
- ⏭️ Balance calculation accurate across all scenarios
- ⏭️ Dashboard API returns correct aggregated data
- ⏭️ Statistics endpoints work dengan date filtering
- ⏭️ Categories CRUD works (default + custom)
- ⏭️ Authorization checks prevent unauthorized access
- ⏭️ Soft delete untuk wallet works properly
- ⏭️ Pagination works correctly
- ⏭️ Error handling works properly
- ⏭️ Validation catches invalid inputs

## Performance Optimization
- Index database columns yang sering di-query:
  - `wallet.user_id` + `wallet.is_active`
  - `transaction.user_id` + `transaction.transaction_date`
  - `transaction.wallet_id`
  - `transfer.user_id` + `transfer.transfer_date`
- Limit query results dengan pagination (default 20 items)
- Cache dashboard statistics menggunakan Cloudflare KV (TTL 5 minutes)
- Batch operations where possible
- Use `SELECT` specific columns instead of `SELECT *`
- Denormalize data: cache `current_balance` di wallet table

## Helper Functions to Implement
```typescript
// src/lib/utils.ts - ✅ IMPLEMENTED

// ✅ Recalculate wallet balance dari transaction & transfer
export async function recalculateWalletBalance(db: Database, walletId: string): Promise<number>

// ✅ Validate wallet ownership
export async function validateWalletOwnership(db: Database, walletId: string, userId: string): Promise<boolean>

// ✅ Get date range for statistics
export function getDateRange(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): { start: Date, end: Date }

// ✅ Format currency for response
export function formatCurrency(amount: number, currency: string = 'IDR'): string

// ✅ Validate transfer between wallet
export async function validateTransfer(db: Database, fromWalletId: string, toWalletId: string, amount: number, userId: string): Promise<{ valid: boolean, error?: string }>

// ✅ Update wallet balance
export async function updateWalletBalance(db: Database, walletId: string): Promise<void>

// ✅ Error response formatter
export function errorResponse(code, message, details?)

// ✅ Success response formatter
export function successResponse(data, meta?)

// ✅ Pagination helpers
export function getPaginationParams(page, limit)
export function paginationMeta(page, limit, total)
```

## Future Enhancements (v2)
- Budget tracking & alerts (set monthly budget per category)
- Recurring transaction (otomatis create transaksi bulanan)
- Export data (CSV/PDF/Excel)
- Multi-currency support (convert antar mata uang)
- Shared wallet/collaboration (family accounts)
- Attach receipts/photos to transaction
- Debt/Loan tracking (utang piutang)
- Financial goals & savings targets
- Notifications (budget exceeded, recurring transaction reminders)
- Data backup & restore
