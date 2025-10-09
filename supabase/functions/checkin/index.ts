// Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("FUNCTION_SUPABASE_URL")!
const SERVICE_KEY   = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })

  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors })

    const body = await req.json().catch(() => ({}))
    const { cust_id = null, phone = null, first_initial = null, last_initial = null } = body ?? {}

    const { data, error } = await supabase.rpc("upsert_contact_minimal", {
      p_cust_id: cust_id,
      p_phone: phone,
      p_first_initial: first_initial,
      p_last_initial: last_initial,
    })

    if (error) return new Response(JSON.stringify({ ok:false, error }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
    return new Response(JSON.stringify({ ok:true, data }), { headers: { ...cors, "content-type":"application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status: 500, headers: { ...cors, "content-type":"application/json" } })
  }
})
