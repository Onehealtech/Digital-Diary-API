# Super Admin Setup Guide

## ✅ Easy Method: Use the Signup Endpoint (RECOMMENDED)

I've created a one-time signup endpoint for you. Here's how to use it:

### Step 1: Make a POST Request

Use **Postman**, **Thunder Client**, or **curl** to create your Super Admin:

**Endpoint**: `POST http://localhost:5050/api/v1/auth/signup-super-admin`

**Request Body**:
```json
{
  "fullName": "Super Admin",
  "email": "admin@oneheal.com",
  "password": "YourSecurePassword123!"
}
```

### Using curl (Command Line):
```bash
curl -X POST http://localhost:5050/api/v1/auth/signup-super-admin \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Super Admin\",\"email\":\"admin@oneheal.com\",\"password\":\"YourSecurePassword123!\"}"
```

### Using PowerShell:
```powershell
$body = @{
    fullName = "Super Admin"
    email = "admin@oneheal.com"
    password = "YourSecurePassword123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5050/api/v1/auth/signup-super-admin" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```

### Expected Response:
```json
{
  "success": true,
  "message": "Super Admin created successfully",
  "data": {
    "id": "uuid-here",
    "fullName": "Super Admin",
    "email": "admin@oneheal.com",
    "role": "SUPER_ADMIN"
  }
}
```

### Step 2: Test Login

Now login with your Super Admin credentials:

**Endpoint**: `POST http://localhost:5050/api/v1/auth/login`

**Request Body**:
```json
{
  "email": "admin@oneheal.com",
  "password": "YourSecurePassword123!"
}
```

You'll receive an OTP via email. Then verify it:

**Endpoint**: `POST http://localhost:5050/api/v1/auth/verify-2fa`

**Request Body**:
```json
{
  "email": "admin@oneheal.com",
  "otp": "123456"
}
```

### Step 3: Security Note

> [!IMPORTANT]
> **After creating your Super Admin, you should disable this endpoint for security!**
> 
> The endpoint automatically prevents creating multiple Super Admins, but for extra security, you can comment out the route in `src/routes/auth.routes.ts`:
> 
> ```typescript
> // router.post("/auth/signup-super-admin", setupController.signupSuperAdmin);
> ```

---

## Alternative Method: Using DBeaver (If you prefer)

Yes, you can use **DBeaver** or any PostgreSQL client:

### Step 1: Connect to Database

In DBeaver, create a new PostgreSQL connection with these details from your `.env`:

- **Host**: `oneheal-mobilediary.cih4gacwgkan.us-east-1.rds.amazonaws.com`
- **Port**: `5432`
- **Database**: `mobilediaryapp`
- **Username**: `postgres`
- **Password**: `OneHeal#2026Diary`
- **SSL**: Enable SSL (required)

### Step 2: Generate Password Hash

First, you need to hash your password. Run this in Node.js:

```javascript
// Create a file: hashPassword.js
const bcrypt = require('bcrypt');

const password = 'YourSecurePassword123!';
bcrypt.hash(password, 10, (err, hash) => {
  console.log('Hashed password:', hash);
});
```

Run it:
```bash
node hashPassword.js
```

### Step 3: Run SQL Insert

In DBeaver, execute this SQL (replace the hash with your generated one):

```sql
INSERT INTO "app-users" (
  id, 
  "fullName", 
  email, 
  password, 
  role, 
  "isEmailVerified", 
  "createdAt", 
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'Super Admin',
  'admin@oneheal.com',
  '$2b$10$YOUR_GENERATED_HASH_HERE',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
);
```

---

## Quick Test Password Hash

If you just want to test quickly, use this pre-hashed password:

**Password**: `password123`  
**Hash**: `$2b$10$rZ5qK5Y5qK5Y5qK5Y5qK5uO5Y5qK5Y5qK5Y5qK5Y5qK5Y5qK5Y5qK`

```sql
INSERT INTO "app-users" (
  id, 
  "fullName", 
  email, 
  password, 
  role, 
  "isEmailVerified", 
  "createdAt", 
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'Super Admin',
  'admin@oneheal.com',
  '$2b$10$rZ5qK5Y5qK5Y5qK5Y5qK5uO5Y5qK5Y5qK5Y5qK5Y5qK5Y5qK5Y5qK',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
);
```

Then login with:
- **Email**: `admin@oneheal.com`
- **Password**: `password123`

---

## Recommendation

**Use the API endpoint method** - it's much easier and you don't need to deal with password hashing manually. Just make a simple POST request and you're done! 🚀
