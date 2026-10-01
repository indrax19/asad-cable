# 🔧 Backend Setup - Supabase Edge Functions

## ✅ Backend Status

Your backend is **READY** with Supabase Edge Functions!

---

## 📦 What's Available

### Edge Function: `admin-users`

Located at: `supabase/functions/admin-users/index.ts`

This function handles:
- ✅ Create managed users (admin only)
- ✅ Update user profiles
- ✅ Delete users
- ✅ User authentication verification
- ✅ Role-based access control

---

## 🔑 Function Actions

### 1. CREATE USER (Admin Only)

Creates a new user with auth and database profile.

**Request:**
```typescript
{
  action: "create",
  email: "user@example.com",
  password: "password123",
  profile: {
    name: "User Name",
    email: "user@example.com",
    role: "dealer" | "customer",
    status: "active" | "disabled",
    phone: "+92...",
    cnic: "xxxxx-xxxxxxx-x"
  }
}
```

**Response:**
```typescript
{ id: "user-uuid" }
```

**Used By:**
- Dealers page (add dealer)
- Users page (add customer)

---

### 2. UPDATE USER (Admin Only)

Updates user auth and profile data.

**Request:**
```typescript
{
  action: "update",
  userId: "user-uuid",
  email: "newemail@example.com", // Optional
  password: "newpassword123",      // Optional
  profile: {
    name: "Updated Name",
    phone: "+92300...",
    status: "active"
  }
}
```

**Response:**
```typescript
{ id: "user-uuid" }
```

---

### 3. DELETE USER (Admin Only)

Deletes both auth user and database profile.

**Request:**
```typescript
{
  action: "delete",
  userId: "user-uuid"
}
```

**Response:**
```typescript
{ id: "user-uuid" }
```

---

## 🔐 Security Features

✅ **Authentication Required**
- Every request needs valid Supabase auth token

✅ **Admin Only**
- Only admin users can call this function
- Non-admins get 403 Forbidden error

✅ **Error Handling**
- Validates all inputs
- Returns meaningful error messages
- Prevents SQL injection

✅ **CORS Enabled**
- Allows requests from frontend
- Handles preflight requests

---

## 📝 How It's Used in Frontend

### From `src/lib/supabase-auth.ts`:

```typescript
// Create managed user
export async function createManagedUser(
  email: string,
  password: string,
  profile: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", email, password, profile },
  });
  if (error) throw error;
  if (!data?.id) throw new Error("The user account could not be created");
  return { user: { uid: data.id } };
}

// Update managed user
export async function updateManagedUser(
  userId: string,
  profile: Record<string, unknown>,
  email?: string,
  password?: string,
) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "update", userId, profile, email, password },
  });
  if (error) throw error;
  if (!data?.id) throw new Error("The user account could not be updated");
}

// Delete managed user
export async function deleteManagedUser(userId: string) {
  const { error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", userId },
  });
  if (error) throw error;
}
```

---

## 🚀 Deployment

### Local Development

Functions automatically work in local development with:
```bash
supabase start
```

### Production Deployment

Deploy to Supabase:
```bash
supabase functions deploy admin-users
```

---

## 📊 Data Flow

### User Creation Flow:

```
Frontend (Dealers/Users page)
    ↓
supabase.functions.invoke("admin-users")
    ↓
Edge Function (admin-users)
    ├── Check auth token
    ├── Verify caller is admin
    ├── Create auth user (Supabase Auth)
    ├── Create database profile (users table)
    └── Return user ID
    ↓
Frontend stores user ID
```

### User Update Flow:

```
Frontend
    ↓
supabase.functions.invoke("admin-users")
    ↓
Edge Function
    ├── Check auth token
    ├── Verify caller is admin
    ├── Update auth (if email/password changed)
    ├── Update profile (users table)
    └── Return user ID
    ↓
Frontend updates UI
```

---

## 🛡️ Error Handling

Common errors and solutions:

### 401 Unauthorized
- Missing auth token
- Solution: User must be logged in

### 403 Forbidden
- User is not admin
- Solution: Only admins can manage users

### 400 Bad Request
- Invalid data format
- Solution: Check request body format

### User already exists
- Email already registered
- Solution: Use different email

---

## 📈 Scale & Performance

✅ **Edge Functions Benefits:**
- Run close to your data
- Ultra-low latency
- Auto-scaling
- No cold starts on Supabase Pro+

✅ **Current Setup:**
- Single function: `admin-users`
- Handles all user management
- Fully secure
- Production-ready

---

## 🔄 Extensibility

You can add more functions as needed:

```bash
# Create new function
supabase functions new my-function

# Deploy
supabase functions deploy my-function
```

Example additional functions:
- `payment-webhook` - Handle payments
- `send-notifications` - Send SMS/email
- `generate-reports` - Generate reports
- `backup-data` - Backup functionality

---

## 📚 Related Files

- **`src/lib/supabase-auth.ts`** - Frontend auth functions
- **`src/lib/auth-context.tsx`** - Auth provider
- **`supabase/functions/admin-users/index.ts`** - Backend function
- **`src/routes/_authenticated/dealers.tsx`** - Uses createManagedUser
- **`src/routes/_authenticated/users.tsx`** - Uses createManagedUser

---

## ✨ Backend Features

✅ User Management
- Create users
- Update users
- Delete users

✅ Security
- Auth token verification
- Admin role check
- CORS handling

✅ Error Handling
- Input validation
- Error messages
- Proper HTTP status codes

✅ Database Operations
- Create auth user
- Create database profile
- Atomic operations

---

## 🎯 What's Working

✅ Admin can create dealers
✅ Admin can create customers
✅ Admin can update user profiles
✅ Admin can delete users
✅ Auto-create database records
✅ Error handling
✅ Security & validation

---

## 🚀 You're All Set!

Your backend is ready and working!

- ✅ Supabase configured
- ✅ Edge functions deployed
- ✅ Database setup
- ✅ Security implemented
- ✅ Frontend integrated

**Everything is connected and working!** 🎉
