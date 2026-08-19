# Quick Start Guide - ASAD Cable CRM

## 🔧 Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase Database (One-time only)

1. Go to your Supabase project: https://app.supabase.com
2. Click **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL from `supabase/migrations/20260311000000_initialize_cable_crm.sql`
5. Click **Run**

Done! Your tables are created.

### 3. Environment Variables (Already Set)
Your `.env` and `.env.local` files are already configured with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 4. Run Development Server
```bash
npm run dev
```

Open http://localhost:5173 in your browser

### 5. Create First Admin Account

1. Go to Supabase Dashboard → Authentication → Users
2. Click **Create new user**
3. Enter email and password
4. Go to SQL Editor and run:

```sql
INSERT INTO public.users (id, data) VALUES (
  'USER_ID_FROM_AUTH',
  '{
    "uid": "USER_ID_FROM_AUTH",
    "name": "Admin Name",
    "email": "admin@email.com",
    "role": "admin",
    "status": "active",
    "createdAt": 1704067200000
  }'
);
```

Replace `USER_ID_FROM_AUTH` with the user ID from Supabase Auth.

## ⚙️ Configuration

### Supabase URLs
- Project URL: https://xvjsobbhtwcyelzzibym.supabase.co
- Anon Key: sb_publishable_B9gLfzj_XY31ceEMlFnsdw_0cRS5jmx

### Database Tables
- `users` - Admin, dealers, customers
- `areas` - Service areas
- `packages` - Internet packages
- `payments` - Payment records
- `dealer_recoveries` - Dealer amounts
- `paymentMethods` - Payment methods
- `advertisements` - Ads
- `paymentCorrections` - Payment adjustments

## 🚀 Common Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 Create New User (Dealer/Customer)

Use the admin panel at `/dealers` or `/users` routes:

1. Click **Add Dealer** or **Add New Customer**
2. Fill form with details
3. System creates auth user and saves to database automatically

## 🔐 Password Reset

1. Users can click "Forgot password?" on login page
2. Enter email → check inbox for reset link
3. Set new password

## 📊 Database Data Format

All user data is stored in JSONB format:

```json
{
  "uid": "user-id",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin|dealer|customer",
  "status": "active|disabled",
  "phone": "+92...",
  "cnic": "xxxxx-xxxxxxx-x",
  "address": "...",
  "createdAt": 1704067200000
}
```

## 🐛 Troubleshooting

### Login page not loading
- Check that `.env.local` has Supabase URL and key
- Verify build: `npm run build`

### Tables not found
- Run the SQL migration in Supabase SQL Editor
- Check table names in Supabase Dashboard → Tables

### Authentication failing
- Go to Supabase Authentication → URL Configuration
- Add your app URL (e.g., `http://localhost:5173`)

### Real-time updates not working
- Check that tables have Realtime enabled in Supabase
- Run migration script to enable it

## 📚 More Info

See `SUPABASE_SETUP.md` for detailed database setup.

## ✅ Verification Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Supabase migration SQL executed
- [ ] Environment variables set (already done)
- [ ] Development server running (`npm run dev`)
- [ ] Login page loads at http://localhost:5173/login
- [ ] Can create first admin user
- [ ] Can login with admin credentials
