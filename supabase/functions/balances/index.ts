// Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("FUNCTION_SUPABASE_URL")!
const SERVICE_KEY   = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })

  try {
    if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: cors })

    const url = new URL(req.url)
    const phone = url.searchParams.get("phone")
    if (!phone) return new Response(JSON.stringify({ ok:false, error:"phone required" }), { status: 400, headers: { ...cors, "content-type":"application/json" } })

    // exact match on normalized phone stored in contacts
    const { data, error } = await supabase
      .from("v_contact_balances")
      .select("*")
      .eq("phone", phone)

    if (error) return new Response(JSON.stringify({ ok:false, error }), { status: 400, headers: { ...cors, "content-type":"application/json" } })

    return new Response(JSON.stringify({ ok:true, data }), { headers: { ...cors, "content-type":"application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status: 500, headers: { ...cors, "content-type":"application/json" } })
  }
})
