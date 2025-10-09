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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const {
      cust_id = null,
      phone = null,              // if no cust_id, we’ll use phone
      perk_code,
      qty = 1,
      idempotency_key,
      actor = "frontdesk",
      note = null
    } = body ?? {}

    if (!perk_code) {
      return new Response(JSON.stringify({ ok:false, error:"perk_code required" }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
    }
    if (!idempotency_key || String(idempotency_key).length < 6) {
      return new Response(JSON.stringify({ ok:false, error:"idempotency_key required (>=6 chars)" }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
    }

    let result
    if (cust_id) {
      // Scan flow: redeem by cust_id
      const { data, error } = await supabase.rpc("redeem_by_cust_id", {
        p_cust_id: cust_id,
        p_perk_code: perk_code,
        p_qty: qty,
        p_idempotency_key: idempotency_key,
        p_actor: actor,
        p_note: note
      })
      if (error) return new Response(JSON.stringify({ ok:false, error }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
      result = data
    } else if (phone) {
      // Phone flow: lookup + redeem in one call
      const { data, error } = await supabase.rpc("get_balance_or_redeem_by_phone", {
        p_phone: phone,
        p_perk_code: perk_code,
        p_qty: qty,
        p_idempotency_key: idempotency_key,
        p_do_redeem: true,
        p_actor: actor,
        p_note: note
      })
      if (error) return new Response(JSON.stringify({ ok:false, error }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
      result = data
    } else {
      return new Response(JSON.stringify({ ok:false, error:"cust_id or phone required" }), { status: 400, headers: { ...cors, "content-type":"application/json" } })
    }

    return new Response(JSON.stringify({ ok:true, data: result }), { headers: { ...cors, "content-type":"application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status: 500, headers: { ...cors, "content-type":"application/json" } })
  }
})
