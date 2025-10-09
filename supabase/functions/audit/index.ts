import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("FUNCTION_SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100));
  const phone = url.searchParams.get("phone") || null;

  let q = db
    .from("v_redemptions_audit_plus")
    .select("entry_id,cust_id,phone,perk_code,qty,source,created_at,actor,note,ref_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (phone) q = q.eq("phone", phone);

  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ ok:false, error }), { status: 400, headers: CORS });
  return new Response(JSON.stringify({ ok:true, data }), { headers: CORS });
});
