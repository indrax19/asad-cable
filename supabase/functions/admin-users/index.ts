import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user: caller } } = await client.auth.getUser();
  if (!caller) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: callerProfile } = await admin.from("users").select("data").eq("id", caller.id).maybeSingle();
  if (callerProfile?.data?.role !== "admin") return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { action, userId, email, password, profile } = await request.json();

  if (action === "create") {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
    const { error: profileError } = await admin.from("users").upsert({ id: data.user.id, data: profile });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return Response.json({ error: profileError.message }, { status: 400, headers: corsHeaders });
    }
    return Response.json({ id: data.user.id }, { headers: corsHeaders });
  }

  if (action === "update") {
    const authUpdate = email || password ? await admin.auth.admin.updateUserById(userId, { ...(email && { email }), ...(password && { password }) }) : { error: null };
    if (authUpdate.error) return Response.json({ error: authUpdate.error.message }, { status: 400, headers: corsHeaders });
    const { error } = await admin.from("users").update({ data: profile }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
    return Response.json({ id: userId }, { headers: corsHeaders });
  }

  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
    await admin.from("users").delete().eq("id", userId);
    return Response.json({ id: userId }, { headers: corsHeaders });
  }

  return new Response("Unknown action", { status: 400, headers: corsHeaders });
});
