-- STEP 1: Create auth user in Supabase
-- Go to: https://app.supabase.com → Authentication → Users
-- Click "Create new user"
-- Email: umair@aviratechnologies.com
-- Password: 12345678
-- Click "Create user"
-- COPY THE USER ID (it will look like: 550e8400-e29b-41d4-a716-446655440000)

-- STEP 2: Run this SQL after getting the user ID
-- Replace YOUR_USER_ID with the actual ID you got from Step 1

INSERT INTO public.users (id, data) VALUES (
  'YOUR_USER_ID',
  '{
    "uid": "YOUR_USER_ID",
    "name": "Umair",
    "email": "umair@aviratechnologies.com",
    "role": "admin",
    "status": "active",
    "phone": "+92",
    "createdAt": 1704067200000
  }'
);

-- DONE! Now you can login with:
-- Email: umair@aviratechnologies.com
-- Password: 12345678
