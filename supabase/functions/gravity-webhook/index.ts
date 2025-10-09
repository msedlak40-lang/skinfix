// supabase/functions/gravity-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("FUNCTION_SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("GRAVITY_WEBHOOK_SHARED_SECRET") || ""; // optional for now

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false } });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-signature, x-gravity-signature",
  "content-type": "application/json",
};

function normPhone(p?: string | null) {
  if (!p) return null;
  const d = (p as string).replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === "1") return `+${d}`;
  return p.startsWith("+") ? p : (d ? `+${d}` : null);
}

async function logEvent(status: number, source: string, event_type: string, payload: unknown) {
  await db.from("webhook_logs").insert({
    source, event_type, http_status: status, payload,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, error:"Method Not Allowed" }), { status:405, headers: CORS });
  }

  // Basic shared-secret check (adjust header name to what Gravity provides when you have it)
  const sig = req.headers.get("x-gravity-signature") || req.headers.get("x-signature") || "";
  if (SHARED_SECRET && sig !== SHARED_SECRET) {
    await logEvent(401, "gravity", "unauthorized", { headers: Object.fromEntries(req.headers), note:"bad signature" });
    return new Response(JSON.stringify({ ok:false, error:"Unauthorized" }), { status:401, headers: CORS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    await logEvent(400, "gravity", "invalid_json", {});
    return new Response(JSON.stringify({ ok:false, error:"Invalid JSON" }), { status:400, headers: CORS });
  }

  // Expected payload shape (flexible; adjust later to Gravity’s exact schema)
  // {
  //   "id": "evt_123",
  //   "type": "payment_succeeded",
  //   "created": "2025-09-24T16:01:00Z",
  //   "data": {
  //     "order_id": "ord_123",
  //     "customer": { "cust_id": "<uuid>", "phone": "+1555..." },
  //     "items": [ { "sku": "MEMBER_FACIAL_MONTHLY", "quantity": 1 } ]
  //   }
  // }

  const eventType = body?.type ?? "unknown";
  const eventId   = body?.id ?? crypto.randomUUID();
  const data      = body?.data ?? {};
  const items     = Array.isArray(data?.items) ? data.items : [];
  const phone     = normPhone(data?.customer?.phone ?? null);
  const custIdRaw = data?.customer?.cust_id ?? null;

  // Accept only payment success for issuing
  if (eventType !== "payment_succeeded") {
    await logEvent(200, "gravity", eventType, body);
    return new Response(JSON.stringify({ ok:true, skipped:true }), { headers: CORS });
  }

  // Resolve cust_id
  let cust_id: string | null = null;
  if (custIdRaw) {
    cust_id = custIdRaw;
  } else if (phone) {
    const { data: found, error } = await db
      .from("contacts")
      .select("cust_id, updated_at")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) {
      await logEvent(400, "gravity", "lookup_error", { error, phone });
      return new Response(JSON.stringify({ ok:false, error:"contact_lookup_failed" }), { status:400, headers: CORS });
    }
    cust_id = found?.[0]?.cust_id ?? null;
  }

  if (!cust_id) {
    await logEvent(200, "gravity", "no_contact", { phone, body });
    return new Response(JSON.stringify({ ok:true, no_contact:true }), { headers: CORS });
  }

  // Build issues to insert from sku mappings
  // For each item: look up perk in perk_mappings, multiply by quantity
  const issues: Array<any> = [];
  for (const it of items) {
    const sku = it?.sku;
    const qty = Number(it?.quantity ?? 0);
    if (!sku || !qty) continue;

    const { data: map, error: mapErr } = await db
      .from("perk_mappings")
      .select("perk_code, qty_per_unit")
      .eq("sku", sku)
      .limit(1);
    if (mapErr) {
      await logEvent(400, "gravity", "mapping_error", { sku, error: mapErr });
      continue;
    }
    const m = map?.[0];
    if (!m) continue;

    const totalQty = Number(m.qty_per_unit) * qty;
    const ref = `${eventId}:${sku}`; // idempotency key per sku line

    issues.push({
      cust_id,
      source: "gravity",
      action: "issue",
      perk_code: m.perk_code,
      qty: totalQty,
      ref_id: ref,
      metadata: { order_id: data?.order_id ?? null, sku, event_id: eventId }
    });
  }

  if (issues.length === 0) {
    await logEvent(200, "gravity", "no_mapped_items", body);
    return new Response(JSON.stringify({ ok:true, issued:0 }), { headers: CORS });
  }

  // Insert, rely on unique index (action='issue', ref_id) for idempotency
  const { error: insErr } = await db.from("entitlements_ledger").insert(issues);
  if (insErr) {
    // If unique violation, treat as idempotent success
    const msg = String(insErr.message || "");
    const isIdem = msg.includes("duplicate key") || msg.includes("already exists");
    await logEvent(isIdem ? 200 : 400, "gravity", isIdem ? "idempotent" : "insert_error", { error: insErr, issues });
    if (!isIdem) {
      return new Response(JSON.stringify({ ok:false, error:"insert_failed" }), { status:400, headers: CORS });
    }
  }

  await logEvent(200, "gravity", eventType, body);
  return new Response(JSON.stringify({ ok:true, issued: issues.length }), { headers: CORS });
});
