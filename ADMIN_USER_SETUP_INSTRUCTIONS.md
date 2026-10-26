# 👨‍💼 Create Admin User - Step by Step

## User Details
- **Name:** Umair
- **Email:** umair@aviratechnologies.com
- **Password:** 12345678
- **Role:** Admin

---

## ✅ Complete Instructions

### STEP 1: Create Auth User (5 minutes)

1. Go to **https://app.supabase.com**
2. Select your project
3. Click **Authentication** (left sidebar)
4. Click **Users** tab
5. Click **Create new user** button (top right)
6. Fill in:
   - Email: `umair@aviratechnologies.com`
   - Password: `12345678`
   - Confirm Password: `12345678`
7. Click **Create user**

### STEP 2: Copy the User ID

After clicking "Create user":
1. A new user will appear in the list
2. **Click on the user row** to open details
3. Look for **User ID** at the top (format: `550e8400-e29b-41d4-a716-446655440000`)
4. **Click the copy icon** or select and copy the ID
5. **Paste it somewhere temporarily** (notepad)

### STEP 3: Add User to Database

1. Go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. **Copy this SQL:**

```sql
INSERT INTO public.users (id, data) VALUES (
  'REPLACE_WITH_USER_ID',
  '{
    "uid": "REPLACE_WITH_USER_ID",
    "name": "Umair",
    "email": "umair@aviratechnologies.com",
    "role": "admin",
    "status": "active",
    "phone": "+92",
    "createdAt": 1704067200000
  }'
);
```

4. **Replace `REPLACE_WITH_USER_ID` twice** with the user ID you copied
5. Click **Run**
6. You should see: `Inserted 1 row` ✅

---

## 🎯 Test Login

1. Open your app: **http://localhost:5173/login**
2. Enter:
   - Email: `umair@aviratechnologies.com`
   - Password: `12345678`
3. Click **Sign in**
4. You should be logged in! ✅

---

## 📸 Screenshots Reference

### Step 1 - Create User Button
```
Authentication → Users → [Create new user button]
```

### Step 2 - User ID Location
```
After creating, click user row to see:
User ID: 550e8400-e29b-41d4-a716-446655440000
```

### Step 3 - SQL Query
```
SQL Editor → New Query → Paste SQL → Run
```

---

## ✨ If Something Goes Wrong

### "User already exists"
- User was already created
- Use same email or create with different email

### "ERROR: Duplicate key value"
- User ID already exists in database
- Check if user was already added

### "Invalid email"
- Make sure email is typed correctly
- Try again with: umair@aviratechnologies.com

### "Login failed"
- Make sure you ran Step 3 (added user to database)
- Check password is correct: 12345678
- Clear browser cache and try again

---

## 🔑 Login Credentials (Confirmed)

```
Email:    umair@aviratechnologies.com
Password: 12345678
Role:     Admin
Status:   Active
```

Save these somewhere safe!

---

## Next: Create More Users

After admin user is created, you can:

1. **Add Dealers** → Go to `/dealers` → Click "Add Dealer"
2. **Add Customers** → Go to `/users` → Click "Add New Customer"

Both will auto-create auth users and database entries.

---

Ready? Let's do it! 🚀
