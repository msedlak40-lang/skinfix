// supabase/functions/clover-webhook/index.ts
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Basic shared-secret validation (fast + simple).
// In Clover: set your webhook to send header: x-clover-signature: <your-shared-secret>
const SHARED_SECRET = Deno.env.get("CLOVER_WEBHOOK_SHARED_SECRET") || "";

// Supabase (service role only used inside the function; never expose client-side)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type CloverEvent = {
  type: string; // e.g., "payment_succeeded"
  data?: Record<string, unknown>;
  customer?: { id?: string } | null; // adjust if your payload differs
  // you can add other fields as you learn Clover’s exact body
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Very simple shared-secret check
    const sig = req.headers.get("x-clover-signature") || "";
    if (!SHARED_SECRET || sig !== SHARED_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const evt = (await req.json()) as CloverEvent;

    // ---- minimal routing: on payment_succeeded, issue 1 unit of FACIAL_CREDIT ----
    if (evt.type === "payment_succeeded") {
      const cloverCustomerId =
        (evt.customer && (evt.customer as any).id) ||
        (evt.data && (evt.data as any).customerId) ||
        null;

      if (!cloverCustomerId) {
        // no customer in payload—nothing to do
        return new Response(JSON.stringify({ ok: true, reason: "no customer id" }), {
          headers: { "content-type": "application/json" },
        });
      }

      // map Clover ID -> our anon cust_id
      const { data: mapRow, error: mapErr } = await supabase
        .from("clover_customers")
        .select("cust_id")
        .eq("clover_customer_id", cloverCustomerId)
        .maybeSingle();

      if (mapErr) {
        console.error("map lookup error", mapErr);
        return new Response("Mapping error", { status: 500 });
      }
      if (!mapRow?.cust_id) {
        // we haven't mapped this Clover customer yet—safe no-op
        return new Response(JSON.stringify({ ok: true, reason: "no mapping for customer" }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Issue 1 unit of FACIAL_CREDIT (adjust perk_code later to your real plans)
      const { error: insErr } = await supabase.from("entitlements_ledger").insert({
        cust_id: mapRow.cust_id,
        source: "membership",
        action: "issue",
        perk_code: "FACIAL_CREDIT",
        qty: 1,
        ref_id: `clover:${cloverCustomerId}`,
        metadata: { clover: evt },
      });

      if (insErr) {
        console.error("insert error", insErr);
        return new Response("Insert error", { status: 500 });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("handler error", e);
    return new Response("Server error", { status: 500 });
  }
});
