// supabase/functions/perks/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// read stage/dev secrets injected at deploy-time
const SUPABASE_URL = Deno.env.get("FUNCTION_SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!;

// service client (no user session persisted)
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "content-type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), { status: 405, headers: CORS });
  }

  const { data, error } = await db
    .from("perk_caps")
    .select("perk_code,daily_cap")
    .order("perk_code");

  if (error) {
    return new Response(JSON.stringify({ ok: false, error }), { status: 400, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, data }), { headers: CORS });
});
