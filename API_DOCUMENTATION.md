# 📡 API Documentation - Supabase Backend

## 🔗 API Endpoints

Your backend uses **Supabase Edge Functions**. Here are all available endpoints:

---

## 1️⃣ Admin Users Function

**Endpoint:** `supabase.functions.invoke("admin-users")`

**Base URL:** `https://xvjsobbhtwcyelzzibym.supabase.co/functions/v1/admin-users`

---

## 📮 CREATE USER

Creates a new authenticated user and database profile.

### Request

```typescript
POST /functions/v1/admin-users
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "action": "create",
  "email": "dealer@example.com",
  "password": "secure_password_123",
  "profile": {
    "name": "Dealer Name",
    "email": "dealer@example.com",
    "role": "dealer",
    "status": "active",
    "phone": "+92300123456",
    "cnic": "12345-1234567-1",
    "address": "Street Address",
    "createdAt": 1704067200000
  }
}
```

### Response (Success)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response (Error)

```json
{
  "error": "Email already registered"
}
```

### Status Codes

- `200` - User created successfully
- `400` - Invalid data or user already exists
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not admin)

### Frontend Usage

```typescript
import { createManagedUser } from "@/lib/supabase-auth";

const result = await createManagedUser(
  "dealer@example.com",
  "password123",
  {
    name: "Dealer Name",
    email: "dealer@example.com",
    role: "dealer",
    status: "active",
  }
);
```

---

## 📝 UPDATE USER

Updates user authentication and profile data.

### Request

```typescript
POST /functions/v1/admin-users
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "action": "update",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "newemail@example.com",      // Optional
  "password": "new_password_123",        // Optional
  "profile": {
    "name": "Updated Name",
    "phone": "+92300654321",
    "status": "active"
  }
}
```

### Response (Success)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response (Error)

```json
{
  "error": "Email already taken"
}
```

### Status Codes

- `200` - User updated successfully
- `400` - Invalid data
- `401` - Unauthorized
- `403` - Forbidden (not admin)

### Frontend Usage

```typescript
import { updateManagedUser } from "@/lib/supabase-auth";

await updateManagedUser(
  "user-uuid",
  {
    name: "Updated Name",
    phone: "+92300...",
  },
  "newemail@example.com",
  "newpassword123"
);
```

---

## 🗑️ DELETE USER

Deletes user authentication and database profile.

### Request

```typescript
POST /functions/v1/admin-users
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "action": "delete",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response (Success)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response (Error)

```json
{
  "error": "User not found"
}
```

### Status Codes

- `200` - User deleted successfully
- `400` - User not found
- `401` - Unauthorized
- `403` - Forbidden (not admin)

### Frontend Usage

```typescript
import { deleteManagedUser } from "@/lib/supabase-auth";

await deleteManagedUser("user-uuid");
```

---

## 🔐 Authentication

All API endpoints require:

1. **JWT Token** in Authorization header
2. **Admin Role** - Only admins can call these functions
3. **Valid Supabase Session** - User must be logged in

### How to Get JWT Token

Automatically managed by Supabase client:

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: "admin@example.com",
  password: "password123"
});

// Token is automatically included in subsequent requests
```

---

## 📊 Database Tables Updated

### users

When a user is created/updated via API:

```sql
INSERT INTO public.users (id, data) VALUES (
  'user-uuid',
  '{
    "uid": "user-uuid",
    "name": "User Name",
    "email": "user@example.com",
    "role": "dealer|customer",
    "status": "active|disabled",
    "phone": "+92...",
    "createdAt": 1704067200000
  }'
);
```

---

## 🔄 Request/Response Format

### All Requests

```typescript
{
  action: "create" | "update" | "delete",
  userId?: string,        // Required for update/delete
  email?: string,         // Required for create, optional for update
  password?: string,      // Required for create, optional for update
  profile?: object        // Required for create, optional for update
}
```

### All Responses

**Success:**
```json
{
  "id": "user-uuid"
}
```

**Error:**
```json
{
  "error": "Error message here"
}
```

---

## ⚡ Rate Limiting

No rate limiting on Supabase Edge Functions (for Pro plan+)

Free tier: 50,000 invocations per month

---

## 🛠️ Error Codes & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | No auth token | User must be logged in |
| 403 Forbidden | Not admin role | Use admin account |
| 400 Bad Request | Invalid data | Check JSON format |
| Email already registered | Duplicate email | Use different email |
| User not found | Invalid user ID | Check user ID |

---

## 📝 Example Usage

### Create Dealer (From Dealers Page)

```typescript
const result = await createManagedUser(
  "dealer@example.com",
  "RandomPassword123!",
  {
    name: "Ali Ahmed",
    email: "dealer@example.com",
    role: "dealer",
    status: "active",
    phone: "+923001234567",
    cnic: "12345-1234567-1",
    address: "Karachi, Pakistan",
    assignedAreaIds: ["area-uuid"],
    createdAt: Date.now()
  }
);

console.log(result.user.uid); // user-uuid
```

### Update Customer

```typescript
await updateManagedUser(
  "customer-uuid",
  {
    name: "Updated Name",
    phone: "+923009876543",
    status: "active"
  },
  "newemail@example.com",
  "NewPassword123!"
);
```

### Delete User

```typescript
await deleteManagedUser("user-uuid");
```

---

## 🔗 Related Files

- **Implementation:** `supabase/functions/admin-users/index.ts`
- **Frontend Wrapper:** `src/lib/supabase-auth.ts`
- **Usage:** `src/routes/_authenticated/dealers.tsx`
- **Usage:** `src/routes/_authenticated/users.tsx`

---

## ✅ What's Included

✅ User management API
✅ Role-based access control
✅ Error handling
✅ CORS support
✅ JWT authentication
✅ Database integration
✅ Production-ready

---

## 🚀 Ready to Use!

Your API is ready for:
- ✅ Creating users
- ✅ Updating profiles
- ✅ Deleting users
- ✅ Managing access control
- ✅ Production deployments

**Everything is working!** 🎉
