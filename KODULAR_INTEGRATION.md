# Kodular Integration Guide - Simplified

Panduan **SUPER SIMPLE** untuk integrasi Kodular dengan backend Keuanganku.

## 🎯 Konsep Utama

**User management 100% ditangani oleh Firebase Auth.**
Backend **HANYA** fokus ke data keuangan (wallet, transaction, transfer, category).

### Keuntungan Pendekatan Ini:

✅ **Lebih sederhana** - Tidak perlu sync user ke backend
✅ **Lebih cepat** - Langsung bisa pakai API setelah login
✅ **Lebih aman** - User data di-manage oleh Firebase (verified & secure)
✅ **Otomatis** - User info (uid, email, name) sudah ada di token

## 🔐 Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Kodular App                             │
│                                                          │
│  1. User Login (Firebase Auth Component)               │
│     └─ Email/Password atau Google Sign In              │
│                                                          │
│  2. Login Success Event                                 │
│     └─ Dapat: uid, email, name, phone, photo           │
│                                                          │
│  3. Call: FirebaseAuth.GetIdToken                      │
│                                                          │
│  4. Got Id Token Event                                  │
│     └─ Dapat: Firebase ID Token                        │
│                                                          │
│  5. Save Token                                          │
│     └─ TinyDB.StoreValue("token", token)               │
│                                                          │
│  6. Langsung Call API!                                  │
│     └─ Header: Authorization: Bearer <token>           │
│        Backend otomatis dapat userId dari token        │
└─────────────────────────────────────────────────────────┘
```

## 📱 Implementasi Kodular

### Global Variables

```blocks
initialize global firebase_token to ""
initialize global user_uid to ""
initialize global user_email to ""
initialize global user_name to ""
```

### Step 1: Login

```blocks
when Button_Login.Click
  do
    call FirebaseAuth.LoginWithEmailAndPassword
      email: textbox_email.Text
      password: textbox_password.Text

when FirebaseAuth.LoginSuccess
  userId: get userId
  name: get name
  email: get email
  phoneNumber: get phoneNumber
  photoUrl: get photoUrl
  do
    // Simpan user info
    set global user_uid to userId
    set global user_email to email
    set global user_name to name

    // Dapatkan ID token
    call FirebaseAuth.GetIdToken

when FirebaseAuth.GotIdToken
  token: get token
  do
    // Simpan token
    call TinyDB.StoreValue
      tag: "firebase_token"
      valueToStore: token

    set global firebase_token to token

    // Langsung navigate ke home!
    call Screen_Home.Start
```

### Step 2: Make API Call

```blocks
procedure GetWallets
  do
    set Web1.Url to "https://your-api.workers.dev/api/wallet"

    // Set Authorization header dengan token
    set Web1.RequestHeaders to make a list
      make a list
        "Authorization"
        join "Bearer " global firebase_token

    call Web1.Get

when Web1.GotText
  responseCode: get responseCode
  responseContent: get responseContent
  do
    if responseCode = 200 then
      // Success! Parse wallets
      set global wallets to call Web1.JsonTextDecode
        jsonText: responseContent

      call DisplayWallets
    else if responseCode = 401 then
      // Token expired, refresh it
      call RefreshToken
    else
      notifier.ShowAlert "Failed to load wallets"
```

### Step 3: Create Wallet

```blocks
procedure CreateWallet
  name: get name
  icon: get icon
  color: get color
  initialBalance: get initialBalance
  do
    set Web_CreateWallet.Url to "https://your-api.workers.dev/api/wallet"

    // Set headers
    set Web_CreateWallet.RequestHeaders to make a list
      make a list "Authorization" join "Bearer " global firebase_token
      make a list "Content-Type" "application/json"

    // Create request body
    set request_body to call Web1.JsonTextEncode
      jsonObject: make a dictionary
        "name" name
        "icon" icon
        "color" color
        "initialBalance" initialBalance

    call Web_CreateWallet.PostText
      text: request_body

when Web_CreateWallet.GotText
  responseCode: get responseCode
  responseContent: get responseContent
  do
    if responseCode = 201 then
      notifier.ShowMessage "Wallet created successfully!"
      call GetWallets  // Refresh wallet list
    else
      notifier.ShowAlert "Failed to create wallet"
```

### Step 4: Refresh Token (Handle Expiry)

Token expire setelah 1 jam. Handle dengan:

```blocks
procedure RefreshToken
  do
    if call FirebaseAuth.IsSignedIn then
      call FirebaseAuth.GetIdToken
    else
      // User signed out, go to login
      call Screen_Login.Start

when FirebaseAuth.GotIdToken
  token: get token
  do
    // Update token
    call TinyDB.StoreValue "firebase_token" token
    set global firebase_token to token

    // Retry last failed API call
    call RetryLastAPICall
```

### Step 5: Auto-Refresh pada 401

```blocks
when Web1.GotText
  responseCode: get responseCode
  do
    if responseCode = 401 then
      // Token expired or invalid
      call RefreshToken
```

### Step 6: Logout

```blocks
when Button_Logout.Click
  do
    call FirebaseAuth.SignOut

when FirebaseAuth.SignOutSuccess
  do
    // Clear token
    call TinyDB.ClearTag "firebase_token"
    set global firebase_token to ""
    set global user_uid to ""

    // Go to login
    call Screen_Login.Start
```

## 🔧 Helper Procedures

### Make Authenticated GET Request

```blocks
procedure AuthenticatedGET
  url: get url
  web_component: get web_component
  do
    set web_component.Url to url
    set web_component.RequestHeaders to make a list
      make a list "Authorization" join "Bearer " global firebase_token

    call web_component.Get
```

### Make Authenticated POST Request

```blocks
procedure AuthenticatedPOST
  url: get url
  body: get body
  web_component: get web_component
  do
    set web_component.Url to url
    set web_component.RequestHeaders to make a list
      make a list "Authorization" join "Bearer " global firebase_token
      make a list "Content-Type" "application/json"

    call web_component.PostText
      text: body
```

## 📊 Data Flow Example

### Membuat Transaksi

```blocks
when Button_SaveTransaction.Click
  do
    set transaction_data to make a dictionary
      "walletId" global selected_wallet_id
      "categoryId" global selected_category_id
      "type" "expense"
      "amount" textbox_amount.Text
      "description" textbox_description.Text
      "transactionDate" call Clock1.Now

    set request_body to call Web1.JsonTextEncode
      jsonObject: transaction_data

    call AuthenticatedPOST
      url: "https://your-api.workers.dev/api/transaction"
      body: request_body
      web_component: Web_CreateTransaction
```

### Get Dashboard Summary

```blocks
when Screen_Dashboard.Initialize
  do
    call AuthenticatedGET
      url: "https://your-api.workers.dev/api/dashboard"
      web_component: Web_Dashboard

when Web_Dashboard.GotText
  responseCode: get responseCode
  responseContent: get responseContent
  do
    if responseCode = 200 then
      set dashboard_data to call Web1.JsonTextDecode
        jsonText: responseContent

      // Update UI dengan data
      set label_total_balance.Text to get value at key path "data.summary.totalBalance" dashboard_data
      set label_total_income.Text to get value at key path "data.summary.totalIncome" dashboard_data
      set label_total_expense.Text to get value at key path "data.summary.totalExpense" dashboard_data
```

## 🎨 UI Design Tips

### Login Screen

- Email TextBox
- Password TextBox (Password Mode: true)
- Login Button
- Notifier untuk error messages

### Home/Dashboard Screen

```blocks
when Screen_Home.Initialize
  do
    // Check if user is logged in
    set global firebase_token to call TinyDB.GetValue
      tag: "firebase_token"
      valueIfTagNotThere: ""

    if global firebase_token = "" then
      // Not logged in, go to login screen
      call Screen_Login.Start
    else
      // Load dashboard data
      call LoadDashboard
      call LoadWallets
      call LoadRecentTransactions
```

## ⚡ Performance Tips

1. **Cache Data Locally**
   ```blocks
   // Save wallets to TinyDB untuk offline access
   call TinyDB.StoreValue "wallets" global wallets
   ```

2. **Background Refresh**
   ```blocks
   when Clock_RefreshData.Timer
     do
       call RefreshToken  // Refresh token sebelum expire
       call LoadDashboard  // Refresh data
   ```

3. **Lazy Loading**
   - Load dashboard dulu (cepat)
   - Load transactions belakangan (lebih banyak data)

## 🐛 Troubleshooting

### Error: "Unauthorized"

**Solusi:**
```blocks
// Pastikan format header benar
// ✅ BENAR:
join "Bearer " global firebase_token

// ❌ SALAH:
join "Bearer" global firebase_token  // Missing space!
```

### Error: "Invalid JSON"

**Solusi:**
```blocks
// Encode JSON dengan benar
set body to call Web1.JsonTextEncode
  jsonObject: make a dictionary ...

// Jangan kirim raw text!
```

### Token Tidak Tersimpan

**Solusi:**
```blocks
// Save token SEGERA setelah dapat
when FirebaseAuth.GotIdToken
  token: get token
  do
    call TinyDB.StoreValue "firebase_token" token  // Ini WAJIB!
```

## ✅ Checklist Integration

- [ ] Firebase Auth component added
- [ ] google-services.json uploaded
- [ ] Login flow implemented
- [ ] GetIdToken called after login
- [ ] Token saved to TinyDB
- [ ] Authorization header set correctly
- [ ] 401 error handling (token refresh)
- [ ] Logout clears token

## 🚀 Quick Start Template

```blocks
// === SCREEN: Login ===
when Button_Login.Click
  call FirebaseAuth.LoginWithEmailAndPassword

when FirebaseAuth.LoginSuccess
  call FirebaseAuth.GetIdToken

when FirebaseAuth.GotIdToken
  call TinyDB.StoreValue "firebase_token" token
  call Screen_Home.Start

// === SCREEN: Home ===
when Screen_Home.Initialize
  set global token to call TinyDB.GetValue "firebase_token" ""
  if token = "" then
    call Screen_Login.Start
  else
    call LoadData

procedure LoadData
  set Web.RequestHeaders to [["Authorization", join "Bearer " global token]]
  set Web.Url to "https://api.com/api/wallet"
  call Web.Get

when Web.GotText
  if responseCode = 200 then
    // Success!
  else if responseCode = 401 then
    call FirebaseAuth.GetIdToken  // Refresh
```

---

**That's it! Super simple! 🎉**

Tidak perlu endpoint `/sync-user`, tidak perlu manage user di backend.
Firebase Auth handle semua user management, backend fokus ke data!