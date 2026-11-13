// Supabase Edge Function: crear-docente
// Secret SUPABASE_SERVICE_ROLE_KEY se configura en el entorno de Supabase, nunca en el frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Falta configurar el secreto de servicio en la función." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sesión requerida." }, 401);

  // Verificamos el usuario con el token entrante, y su rol mediante cliente con RLS.
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) return json({ error: "Sesión inválida." }, 401);
  const { data: callerProfile, error: profileError } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
  if (profileError || callerProfile?.role !== "director") return json({ error: "Solo la directora puede crear cuentas docentes." }, 403);

  let input: { full_name?: string; email?: string; password?: string };
  try { input = await req.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const full_name = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (!full_name || full_name.length > 120) return json({ error: "Ingresá un nombre válido." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Ingresá un correo válido." }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "La contraseña debe tener entre 8 y 128 caracteres." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? "No se pudo crear el usuario." }, 400);

  const { error: insertError } = await admin.from("profiles").upsert({
    id: created.user.id, full_name, role: "teacher",
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "La cuenta no pudo completar su perfil. " + insertError.message }, 500);
  }
  return json({ ok: true, user_id: created.user.id, email });
});
