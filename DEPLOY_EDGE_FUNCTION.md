# 🚀 Deploy Supabase Edge Function

## ❌ Problem
```
"Customer creation is unavailable because the admin-users 
Edge Function is not deployed in Supabase"
```

## ✅ Solution: Deploy the Function

---

## 📋 Prerequisites

Make sure you have:

1. **Supabase CLI** installed
2. **Deno** installed (optional, for local testing)
3. Logged into Supabase

### Install Supabase CLI

```bash
# Using npm
npm install -g @supabase/cli

# Using Homebrew (Mac)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop install supabase
```

Verify installation:
```bash
supabase --version
```

---

## 🔑 Login to Supabase

```bash
supabase login
```

This will:
1. Open browser for authentication
2. Ask for your Supabase credentials
3. Save access token locally

---

## 🔗 Link Your Project

```bash
supabase link --project-ref xvjsobbhtwcyelzzibym
```

Replace `xvjsobbhtwcyelzzibym` with your Supabase project reference.

---

## 📤 Deploy the Function

### Method 1: Deploy to Production (RECOMMENDED)

```bash
supabase functions deploy admin-users
```

This will:
1. Bundle the function
2. Deploy to Supabase
3. Make it available immediately
4. Show deployment URL

### Method 2: Deploy Specific Version

```bash
# Deploy and replace existing
supabase functions deploy admin-users --project-ref xvjsobbhtwcyelzzibym
```

---

## ✅ Verify Deployment

After deployment, you should see:

```
✓ Function admin-users deployed successfully
✓ Function URL: https://xvjsobbhtwcyelzzibym.supabase.co/functions/v1/admin-users
```

---

## 🧪 Test the Function

### Option 1: Using Browser

1. Go to Supabase Dashboard
2. Functions → admin-users
3. Click "Invoke"
4. Copy this test body:

```json
{
  "action": "create",
  "email": "test@example.com",
  "password": "test123456",
  "profile": {
    "name": "Test User",
    "role": "customer",
    "status": "active"
  }
}
```

5. Click "Send Request"
6. Should get back user ID

### Option 2: Using cURL

```bash
curl -X POST https://xvjsobbhtwcyelzzibym.supabase.co/functions/v1/admin-users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "email": "test@example.com",
    "password": "test123456",
    "profile": {
      "name": "Test User",
      "role": "customer",
      "status": "active"
    }
  }'
```

---

## ✨ After Deployment

Once deployed, everything works:

✅ Create customers from Users page  
✅ Create dealers from Dealers page  
✅ Update user profiles  
✅ Delete users  
✅ Reset passwords  

---

## 🛠️ Troubleshooting

### Function Not Found

**Error:** `Function not found`

**Solution:**
```bash
# Check if function exists
supabase functions list

# If not listed, redeploy
supabase functions deploy admin-users
```

### Permission Denied

**Error:** `Permission denied: Cannot write to /supabase`

**Solution:**
```bash
# Logout and login again
supabase logout
supabase login
```

### Authentication Required

**Error:** `Unauthorized` when trying to invoke

**Solution:**
- Make sure you're logged in as admin
- Check JWT token is valid
- Check Authorization header

### Function Timeout

**Error:** `504 Gateway Timeout`

**Solution:**
- Check database query is efficient
- Verify network connectivity
- Try invoking again

---

## 📋 Function Checklist

After deployment, verify:

- ✅ Function is deployed
- ✅ Can create users
- ✅ Can update users
- ✅ Can delete users
- ✅ Admin-only access works
- ✅ Error messages display
- ✅ CORS headers present

---

## 📚 File Structure

```
project/
├── supabase/
│   └── functions/
│       └── admin-users/
│           ├── index.ts          ← Main function code
│           └── ...
├── deno.json                      ← Deno config
└── ...
```

---

## 🔄 Local Development

To test locally before deploying:

```bash
# Start Supabase locally
supabase start

# Logs should show:
# "admin-users" function is available

# In another terminal:
npm run dev

# Try creating a user
```

---

## 🚀 Full Deployment Steps

1. **Install CLI:**
   ```bash
   npm install -g @supabase/cli
   ```

2. **Login:**
   ```bash
   supabase login
   ```

3. **Link Project:**
   ```bash
   supabase link --project-ref xvjsobbhtwcyelzzibym
   ```

4. **Deploy Function:**
   ```bash
   supabase functions deploy admin-users
   ```

5. **Verify:**
   ```bash
   supabase functions list
   ```

6. **Test in App:**
   - Go to Users page
   - Click "Add New Customer"
   - Fill form and submit
   - Should work! ✅

---

## ✅ Success Indicators

After successful deployment:

- ✅ Function appears in Supabase dashboard
- ✅ Can create customers from Users page
- ✅ Can create dealers from Dealers page
- ✅ No "Function not deployed" errors
- ✅ New users appear in database
- ✅ New users get auth created

---

## 🎯 Next Steps

After deployment:

1. ✅ Create test customer
2. ✅ Create test dealer
3. ✅ Update user profile
4. ✅ Delete user
5. ✅ Everything works!

---

## 📞 Support

If deployment fails:

1. Check CLI is installed: `supabase --version`
2. Check logged in: `supabase projects list`
3. Check project ref is correct
4. Try: `supabase functions deploy admin-users --no-verify-jwt`

---

## 🎉 You're Set!

After following these steps, your Edge Function will be deployed and customer creation will work!

**Time needed: 5 minutes** ⏱️
