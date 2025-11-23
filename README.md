# Keuanganku Backend API

Backend API untuk aplikasi Keuanganku, dibangun dengan **Hono** + **Cloudflare D1** + **Firebase Auth** + **Drizzle ORM**.

## 📋 Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                Frontend (Kodular App)                    │
│                  Firebase Auth SDK                       │
└──────────────────────┬──────────────────────────────────┘
                       │ ID Token
                       ▼
┌─────────────────────────────────────────────────────────┐
│            Cloudflare Workers (Hono API)                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Firebase Admin SDK - Verify Token               │  │
│  └──────────────────────────────────────────────────┘  │
│                       │                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Drizzle ORM - Database Operations               │  │
│  └──────────────────────────────────────────────────┘  │
│                       │                                  │
└───────────────────────┼──────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │   Cloudflare D1 (SQLite)  │
        │   - wallets               │
        │   - transactions          │
        │   - categories            │
        │   - transfers             │
        └───────────────────────────┘
```

## 🔐 Authentication Flow

1. **Frontend (Kodular)**: User login dengan Firebase Auth SDK
2. **Frontend**: Dapatkan Firebase ID Token dari authenticated user
3. **Frontend**: Kirim request ke API dengan header: `Authorization: Bearer <ID_TOKEN>`
4. **Backend**: Verify token dengan Firebase Admin SDK
5. **Backend**: Extract user info (uid, email, name) dari token
6. **Backend**: Process request dengan user context

## 🚀 Setup & Installation

### 1. Clone Repository

```bash
git clone <repo-url>
cd backend-keuanganku
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Setup Firebase

#### a. Buat Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru atau gunakan existing project
3. Enable Authentication > Sign-in method > Email/Password

#### b. Download Service Account Key

1. Di Firebase Console, buka **Project Settings** (⚙️)
2. Pilih tab **Service Accounts**
3. Klik **Generate New Private Key**
4. Download file JSON yang dihasilkan

### 4. Setup Environment Variables

#### a. Development (.dev.vars)

Copy `.dev.vars.example` ke `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` dan paste Firebase Service Account JSON:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id"...}
TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173
```

#### b. Production (Cloudflare)

Set environment variable di Cloudflare Dashboard atau via wrangler:

```bash
# Set Firebase Service Account JSON as secret
wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
# Paste entire JSON when prompted

# Or set via wrangler.jsonc
# Add to wrangler.jsonc:
{
  "vars": {
    "TRUSTED_ORIGINS": "https://your-app.com"
  }
}
```

### 5. Setup Database

#### a. Generate Migration

```bash
bun run db:generate
```

#### b. Run Migration (Local)

```bash
bun run db:migrate:local
```

#### c. Run Migration (Production)

```bash
bun run db:migrate:prod
```

### 6. Run Development Server

```bash
bun run dev
```

Server akan berjalan di `http://localhost:8787`

## 📁 Database Schema

> **Note:** User management ditangani 100% oleh Firebase Auth. Backend hanya menyimpan `user_id` (Firebase UID) di setiap tabel untuk ownership.

### Wallet Table
```sql
CREATE TABLE wallet (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- Firebase UID (no FK constraint)
  name TEXT NOT NULL,            -- 'Dana', 'OVO', 'Bank BCA', dll
  icon TEXT,
  color TEXT,
  initial_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Category Table
```sql
CREATE TABLE category (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- Firebase UID (no FK constraint)
  name TEXT NOT NULL,            -- 'Makanan', 'Transport', 'Gaji', dll
  type TEXT NOT NULL,            -- 'income' | 'expense'
  icon TEXT,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### Transaction Table
```sql
CREATE TABLE transaction (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- Firebase UID (no FK constraint)
  wallet_id TEXT NOT NULL REFERENCES wallet(id),
  category_id TEXT REFERENCES category(id),
  type TEXT NOT NULL,            -- 'income' | 'expense'
  amount REAL NOT NULL,
  description TEXT,
  notes TEXT,
  transaction_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Transfer Table
```sql
CREATE TABLE transfer (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- Firebase UID (no FK constraint)
  from_wallet_id TEXT NOT NULL REFERENCES wallet(id),
  to_wallet_id TEXT NOT NULL REFERENCES wallet(id),
  amount REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  description TEXT,
  transfer_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## 🛠️ API Endpoints

### Authentication

Semua endpoint `/api/*` memerlukan Firebase Auth token di header:

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

### Public Endpoints

- `GET /` - API info
- `GET /health` - Health check

### Wallet Endpoints

- `GET /api/wallet` - Get all wallets
- `POST /api/wallet` - Create wallet
- `GET /api/wallet/:id` - Get wallet by ID
- `PUT /api/wallet/:id` - Update wallet
- `DELETE /api/wallet/:id` - Delete wallet (soft delete)

### Category Endpoints

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `GET /api/categories/:id` - Get category by ID
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Transaction Endpoints

- `GET /api/transaction` - Get all transactions (with filters)
- `POST /api/transaction` - Create transaction
- `GET /api/transaction/:id` - Get transaction by ID
- `PUT /api/transaction/:id` - Update transaction
- `DELETE /api/transaction/:id` - Delete transaction

### Transfer Endpoints

- `GET /api/transfer` - Get all transfers
- `POST /api/transfer` - Create transfer
- `GET /api/transfer/:id` - Get transfer by ID
- `PUT /api/transfer/:id` - Update transfer
- `DELETE /api/transfer/:id` - Delete transfer

### Dashboard Endpoints

- `GET /api/dashboard` - Get dashboard summary

### Statistics Endpoints

- `GET /api/statistics/summary` - Get financial summary
- `GET /api/statistics/by-category` - Get statistics by category
- `GET /api/statistics/trends` - Get trends over time

## 🧪 Testing dengan Firebase Token

### 1. Get Firebase ID Token

Di frontend (Kodular), setelah user login:

```javascript
// Get ID Token
firebase.auth().currentUser.getIdToken()
  .then(function(idToken) {
    // Use this token for API requests
    console.log(idToken);
  });
```

### 2. Test API dengan cURL

```bash
# Get user info
curl -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  http://localhost:8787/api/me

# Create wallet
curl -X POST \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dana","icon":"💰","color":"#00BCD4","initialBalance":100000}' \
  http://localhost:8787/api/wallet
```

### 3. Test dengan Postman/Thunder Client

1. Set Authorization Type: **Bearer Token**
2. Paste Firebase ID Token
3. Send request

## 📦 Deployment

### 1. Generate Types

```bash
bun run cf-typegen
```

### 2. Deploy to Cloudflare

```bash
bun run deploy
```

### 3. Run Production Migrations

```bash
bun run db:migrate:prod
```

## 🔧 Scripts

- `bun run dev` - Start development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run cf-typegen` - Generate Cloudflare types
- `bun run db:generate` - Generate Drizzle migrations
- `bun run db:migrate:local` - Run migrations locally
- `bun run db:migrate:prod` - Run migrations in production
- `bun run db:studio` - Open Drizzle Studio

## 🐛 Troubleshooting

### Error: "Token verification failed"

- Pastikan Firebase Service Account JSON benar
- Pastikan ID Token belum expired (expired setelah 1 jam)
- Pastikan project ID di Service Account sesuai dengan Firebase project

### Error: "Unauthorized: Missing or invalid Authorization header"

- Pastikan header `Authorization: Bearer <token>` ada di request
- Format harus: `Bearer ` diikuti token (ada spasi setelah Bearer)

### Error: "Database not found"

- Pastikan migrations sudah dijalankan
- Check `wrangler.jsonc` D1 database binding

## 📚 Tech Stack

- **[Hono](https://hono.dev)** - Web framework untuk Cloudflare Workers
- **[Firebase Admin](https://firebase.google.com/docs/admin/setup)** - Authentication verification
- **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe ORM untuk D1
- **[Cloudflare D1](https://developers.cloudflare.com/d1)** - SQLite database
- **[Cloudflare Workers](https://workers.cloudflare.com)** - Serverless runtime
- **[Zod](https://zod.dev)** - Schema validation

## 📝 License

MIT

---

**Made with ❤️ using Hono + Firebase + Cloudflare**
