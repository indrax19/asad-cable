# 🚀 Final Supabase Setup Guide

## ✅ What's Done
- Firebase completely removed
- Supabase configured and integrated
- All code updated and tested
- Build verified successfully

## 📋 Setup Instructions (3 Steps)

### Step 1: Create Supabase Tables

1. Open Supabase: https://app.supabase.com
2. Go to **SQL Editor** → Click **New Query**
3. **Copy the entire content** from file: `COPY_PASTE_THIS_SQL.sql`
4. **Paste it** into the SQL editor
5. Click **Run**
6. Wait for completion - you should see 8 tables created

### Step 2: Create Admin User

1. In Supabase, go to **Authentication** → **Users**
2. Click **Create new user**
3. Enter:
   - Email: `admin@example.com` (or your email)
   - Password: `SecurePassword123!`
4. Click **Create user**
5. Copy the **User ID** (format: `uuid-like-string`)

### Step 3: Add User to Database

1. Go to **SQL Editor** → **New Query**
2. Paste this (replace `PASTE_USER_ID_HERE` with the ID from Step 2):

```sql
INSERT INTO public.users (id, data) VALUES (
  'PASTE_USER_ID_HERE',
  '{
    "uid": "PASTE_USER_ID_HERE",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active",
    "createdAt": 1704067200000
  }'
);
```

3. Click **Run**

## 🎯 Now Run Your App

```bash
npm install
npm run dev
```

Open: http://localhost:5173/login

Login with:
- Email: `admin@example.com`
- Password: `SecurePassword123!`

## 📦 Project Structure

```
supabase/
  migrations/
    20260311000000_initialize_cable_crm.sql (MAIN MIGRATION)

src/
  lib/
    supabase.ts (Client configuration)
    supabase-store.ts (Database operations)
    supabase-auth.ts (Authentication)
    auth-context.tsx (Auth provider)
```

## 🗄️ Database Tables

All tables store data in JSONB format:

| Table | Purpose |
|-------|---------|
| `users` | Admin, dealers, customers |
| `areas` | Service areas |
| `packages` | Internet packages |
| `payments` | Payment records |
| `payment_corrections` | Payment reversals/reassignments |
| `dealer_recoveries` | Dealer recovery amounts |
| `payment_methods` | Payment methods |
| `advertisements` | Advertisements |

## 🔐 Authentication Flow

1. User signs up/logs in at `/login` or `/signup`
2. Supabase Auth handles credentials
3. User profile loaded from `users` table
4. Role-based access control enforced

## 🌐 Environment Variables

Already set in `.env` and `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xvjsobbhtwcyelzzibym.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_B9gLfzj_XY31ceEMlFnsdw_0cRS5jmx
```

## 📝 Create New Users (Admin Panel)

### Add Dealer
1. Login as admin
2. Go to `/dealers` 
3. Click **Add Dealer**
4. Fill form → Click **Create**
5. System creates auth user + database entry automatically

### Add Customer
1. Go to `/users`
2. Click **Add New Customer**
3. Fill form → Click **Create**
4. Automatic auth user creation

## ⚙️ Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Lint
npm run lint

# Format code
npm run format
```

## 🐛 Troubleshooting

### "Missing Supabase configuration"
- Check `.env.local` has correct URL and key
- Restart dev server

### "Table not found"
- Run the SQL from `COPY_PASTE_THIS_SQL.sql` in Supabase
- Check table names are lowercase with underscores

### "User not found after login"
- Make sure you ran Step 3 (insert user into database)
- Check user ID matches between Auth and database

### "Real-time updates not working"
- Ensure tables have Realtime enabled (already done in migration)
- Check browser console for errors

## 📚 Files to Reference

- `COPY_PASTE_THIS_SQL.sql` - SQL to run in Supabase
- `SUPABASE_SETUP.md` - Detailed database info
- `QUICK_START.md` - Quick reference
- `supabase/migrations/` - Migration files

## ✨ You're All Set!

Everything is configured and ready to go. Just:
1. Run the SQL in Supabase
2. Create your first admin user
3. Run `npm run dev`
4. Login!

Good luck! 🎉
