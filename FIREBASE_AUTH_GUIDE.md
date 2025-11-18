# Firebase Auth Integration Guide

Panduan lengkap untuk mengintegrasikan Firebase Auth dengan Hono API di Cloudflare Workers.

## 🔑 Konsep Utama

### Pembagian Tanggung Jawab

1. **Frontend (Kodular App)**
   - Handle user registration
   - Handle user login/logout
   - Manage Firebase Auth session
   - Generate dan refresh ID tokens
   - Kirim ID token ke backend API

2. **Backend (Cloudflare Workers)**
   - Verify Firebase ID tokens
   - Extract user info dari token
   - Authorize API requests
   - Manage data (wallets, transactions, etc.)
   - **TIDAK** handle login/register

## 📋 Setup Steps

### 1. Firebase Console Setup

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru: `keuanganku`
3. Enable **Authentication**:
   - Klik Authentication di sidebar
   - Tab "Sign-in method"
   - Enable "Email/Password"
4. Download Service Account:
   - Project Settings (⚙️) > Service Accounts
   - Click "Generate New Private Key"
   - Save JSON file

### 2. Backend Setup (Cloudflare Workers)

#### a. Install Dependencies

```bash
bun add firebase-admin
```

#### b. Set Environment Variables

**Development (.dev.vars):**
```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account"...}
TRUSTED_ORIGINS=http://localhost:3000
```

**Production (Cloudflare):**
```bash
wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
# Paste entire JSON when prompted
```

#### c. File Structure

```
src/
├── lib/
│   └── firebase/
│       ├── admin.ts         # Firebase Admin SDK setup
│       └── middleware.ts    # Auth middleware
├── routes/
│   ├── wallet.ts           # Protected routes
│   ├── transaction.ts
│   └── ...
└── index.ts                # Main app
```

### 3. Frontend Setup (Kodular)

#### a. Add Firebase Auth SDK

Di Kodular, tambahkan Firebase Auth component.

#### b. Initialize Firebase

```javascript
// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ...
};

// Initialize
firebase.initializeApp(firebaseConfig);
```

#### c. User Registration

```javascript
// Register new user
firebase.auth().createUserWithEmailAndPassword(email, password)
  .then((userCredential) => {
    const user = userCredential.user;
    console.log("User registered:", user.uid);

    // Get ID token
    return user.getIdToken();
  })
  .then((idToken) => {
    // Send to backend to create user record
    createUserInBackend(idToken, {
      email: user.email,
      name: user.displayName
    });
  })
  .catch((error) => {
    console.error("Registration error:", error);
  });
```

#### d. User Login

```javascript
// Login
firebase.auth().signInWithEmailAndPassword(email, password)
  .then((userCredential) => {
    const user = userCredential.user;
    console.log("User logged in:", user.uid);

    // Get ID token for API calls
    return user.getIdToken();
  })
  .then((idToken) => {
    // Save token for API calls
    localStorage.setItem("firebaseToken", idToken);

    // Now you can call API
    fetchUserData(idToken);
  })
  .catch((error) => {
    console.error("Login error:", error);
  });
```

#### e. Make API Calls

```javascript
// Get current user's ID token
firebase.auth().currentUser.getIdToken()
  .then((idToken) => {
    // Call API with token
    return fetch("https://your-api.workers.dev/api/wallet", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      }
    });
  })
  .then(response => response.json())
  .then(data => {
    console.log("Wallets:", data);
  })
  .catch(error => {
    console.error("API error:", error);
  });
```

#### f. Refresh Token

Firebase ID tokens expire setelah 1 jam. Token akan di-refresh otomatis oleh Firebase SDK, tapi Anda perlu get token yang baru:

```javascript
// Force refresh token
firebase.auth().currentUser.getIdToken(true)
  .then((newToken) => {
    localStorage.setItem("firebaseToken", newToken);
  });
```

#### g. Logout

```javascript
firebase.auth().signOut()
  .then(() => {
    console.log("User signed out");
    localStorage.removeItem("firebaseToken");
  });
```

## 🔐 Backend Implementation

### Firebase Admin SDK ([src/lib/firebase/admin.ts](src/lib/firebase/admin.ts))

```typescript
import * as admin from 'firebase-admin';

export function initializeFirebaseAdmin(serviceAccountJson: string) {
  const serviceAccount = JSON.parse(serviceAccountJson);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function verifyFirebaseToken(idToken: string, serviceAccountJson: string) {
  const app = initializeFirebaseAdmin(serviceAccountJson);
  const decodedToken = await admin.auth(app).verifyIdToken(idToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified,
    name: decodedToken.name,
    picture: decodedToken.picture,
  };
}
```

### Auth Middleware ([src/lib/firebase/middleware.ts](src/lib/firebase/middleware.ts))

```typescript
import { createMiddleware } from 'hono/factory';
import { verifyFirebaseToken, extractBearerToken } from './admin';

export const requireFirebaseAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const decodedToken = await verifyFirebaseToken(
      token,
      c.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

    c.set('firebaseUser', decodedToken);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
```

### Protected Routes Example

```typescript
import { Hono } from 'hono';
import { requireFirebaseAuth } from '../lib/firebase/middleware';

const app = new Hono();

// Apply middleware
app.use('*', requireFirebaseAuth);

// Get user's wallets
app.get('/', async (c) => {
  const firebaseUser = c.get('firebaseUser');
  const userId = firebaseUser.uid; // Firebase UID

  // Query database
  const wallets = await db
    .select()
    .from(walletTable)
    .where(eq(walletTable.userId, userId));

  return c.json({ wallets });
});

export default app;
```

## 🧪 Testing

### 1. Get Firebase ID Token (for testing)

**Via Firebase REST API:**

```bash
curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  --data-binary '{"email":"user@example.com","password":"password123","returnSecureToken":true}'
```

Response:
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",
  "email": "user@example.com",
  "refreshToken": "...",
  "expiresIn": "3600",
  "localId": "firebase_uid_here"
}
```

### 2. Test API Endpoint

```bash
# Use the idToken from above
export TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."

# Test API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/api/me
```

### 3. Test dengan Postman

1. Create new request
2. Set Authorization:
   - Type: **Bearer Token**
   - Token: `<paste your Firebase ID token>`
3. Send request

## 🚨 Common Issues

### Issue 1: "Token verification failed"

**Penyebab:**
- Service Account JSON salah atau tidak lengkap
- Project ID tidak sesuai
- Token sudah expired (> 1 jam)

**Solusi:**
- Re-download Service Account JSON dari Firebase Console
- Pastikan `project_id` di Service Account sesuai dengan Firebase project
- Refresh token di frontend

### Issue 2: "Unauthorized: Missing or invalid Authorization header"

**Penyebab:**
- Header Authorization tidak ada
- Format Bearer token salah

**Solusi:**
- Pastikan header format: `Authorization: Bearer <token>`
- Ada spasi antara "Bearer" dan token
- Token tidak ada quotes

### Issue 3: "Firebase app already exists"

**Penyebab:**
- Firebase Admin SDK di-initialize multiple times

**Solusi:**
- Check singleton pattern di `admin.ts`
- Pastikan hanya initialize sekali

### Issue 4: Token Expired

**Penyebab:**
- Firebase ID tokens expire setelah 1 jam

**Solusi:**
```javascript
// Frontend: Auto-refresh on API error
async function callAPI(endpoint) {
  try {
    const token = await firebase.auth().currentUser.getIdToken();
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Token expired, refresh it
      const newToken = await firebase.auth().currentUser.getIdToken(true);
      // Retry request with new token
      return fetch(endpoint, {
        headers: { Authorization: `Bearer ${newToken}` }
      });
    }

    return response;
  } catch (error) {
    console.error("API call failed:", error);
  }
}
```

## 📱 Kodular Specific

### Get ID Token in Kodular

```blocks
when Firebase_Auth.SignInSuccess
  set global firebaseToken to call Firebase_Auth.GetIdToken
  call MakeAPICall
```

### Make API Call with Token

```blocks
when MakeAPICall
  set Web1.Headers to create list
    ["Authorization", join ["Bearer ", global firebaseToken]]
  set Web1.URL to "https://your-api.workers.dev/api/wallet"
  call Web1.Get
```

### Handle Token Refresh

```blocks
when Web1.GotText
  if responseCode = 401 then
    # Token expired, refresh
    set global firebaseToken to call Firebase_Auth.GetIdToken with forceRefresh true
    call MakeAPICall  # Retry
  else
    # Process response
    ...
```

## 🔒 Security Best Practices

1. **Never expose Service Account JSON di frontend**
   - Service Account hanya untuk backend
   - Frontend hanya butuh Firebase config (public)

2. **Always validate tokens di backend**
   - Jangan percaya client-side validation
   - Always verify dengan Firebase Admin SDK

3. **Use HTTPS in production**
   - Cloudflare Workers otomatis HTTPS
   - Jangan kirim token via HTTP

4. **Implement token refresh logic**
   - Handle expired tokens gracefully
   - Auto-refresh before expiry

5. **Set proper CORS**
   - Only allow trusted origins
   - Don't use wildcard `*` in production

## 📚 Resources

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Hono Documentation](https://hono.dev)
- [Cloudflare Workers](https://workers.cloudflare.com)

---

**Happy Coding! 🚀**
