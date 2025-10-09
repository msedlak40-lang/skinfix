import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING     = Deno.env.get("NUDGE_SIGNING_SECRET")!;
const TWILIO_SID  = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM") || "";

const supa = createClient(supabaseUrl, serviceKey);
const te = new TextEncoder();

function b64url(bytes: Uint8Array){
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function buildOneTap(cust_id: string, place_ref = "google", ttlMins = 20160) {
  if (!SIGNING) throw new Error("Missing NUDGE_SIGNING_SECRET");
  const payload = { cust_id, place_ref, exp: Math.floor(Date.now()/1000) + (ttlMins*60) };
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", te.encode(SIGNING), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(payloadB64));
  const token = payloadB64 + "." + b64url(new Uint8Array(sig));
  const base = new URL("/reviews-one-tap", supabaseUrl.replace(".co",".co/functions")).toString();
  return `${base}?t=${token}`;
}

async function sendSms(to: string, body: string){
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    throw new Error("Missing Twilio secrets (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM)");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const creds = btoa(`${TWILIO_SID}:${TWILIO_AUTH}`);
  const form = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Twilio returns helpful error codes; bubble them up:
    const code = (json && (json.code || json.error_code)) ?? res.status;
    const msg  = (json && (json.message || json.detail)) ?? JSON.stringify(json);
    throw new Error(`Twilio ${res.status} (code ${code}): ${msg}`);
  }
  return json; // has sid
}

function toMessage(e: unknown) {
  // Make sure we never return "[object Object]"
  try {
    if (e instanceof Error) return e.message;
    // PostgREST errors, fetch errors, etc.
    // @ts-ignore
    return e?.message ?? e?.error ?? e?.toString?.() ?? JSON.stringify(e);
  } catch {
    return String(e);
  }
}

Deno.serve(async (req) => {
  try {
    // Optional JSON body: { to, cust_id, place_ref, limit }
    const body = (req.method !== "GET") ? await req.json().catch(()=> ({})) : {};
    const overrideTo   = (body.to ?? "").trim();
    const overrideCust = (body.cust_id ?? "").trim();
    const place        = (body.place_ref ?? "google").trim();
    const limit        = Number(body.limit ?? 100);

    // Quick config sanity: show what’s missing (200 response, no send)
    if (body?.debug === true) {
      return new Response(JSON.stringify({
        ok: true,
        debug: {
          has_SIGNING: !!SIGNING,
          has_TWILIO_SID: !!TWILIO_SID,
          has_TWILIO_AUTH: !!TWILIO_AUTH,
          has_TWILIO_FROM: !!TWILIO_FROM
        }
      }), { headers: { "Content-Type":"application/json" } });
    }

    // Override path for quick test
    if (overrideTo && overrideCust) {
      const link = await buildOneTap(overrideCust, place);
      const msg  = `Hi! Quick reminder—if you posted your ${place} review, tap to confirm: ${link}\n\nReply STOP to opt out.`;
      const tw = await sendSms(overrideTo, msg);
      await supa.from("review_nudges").insert({
        cust_id: overrideCust,
        place_ref: place,
        channel: "sms",
        provider_id: tw?.sid ?? null,
        status: "sent",
        meta: { override: true }
      });
      return new Response(JSON.stringify({ ok: true, sent: 1, results: [{ override: true, to: overrideTo, sid: tw?.sid ?? null }] }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Normal path: pull candidates
    const { data: candidates, error } = await supa.rpc("get_review_nudge_candidates", { p_limit: limit });
    if (error) throw new Error(`get_review_nudge_candidates failed: ${error.message || JSON.stringify(error)}`);

    let sent = 0; const results: any[] = [];
    for (const c of (candidates || [])) {
      const phone = (c.phone || "").trim();
      if (!phone) { results.push({ cust_id: c.cust_id, skipped: "no phone" }); continue; }

      const link = await buildOneTap(c.cust_id, c.place_ref);
      const msg  = `Hi! Quick reminder—if you posted your ${c.place_ref} review, tap to confirm: ${link}\n\nReply STOP to opt out.`;
      try {
        const tw = await sendSms(phone, msg);
        await supa.from("review_nudges").insert({
          cust_id: c.cust_id,
          place_ref: c.place_ref,
          review_id: c.review_id,
          channel: "sms",
          provider_id: tw?.sid ?? null,
          status: "sent",
          meta: { clicked_ts: c.clicked_ts }
        });
        sent++; results.push({ cust_id: c.cust_id, sid: tw?.sid ?? null });
      } catch (e) {
        results.push({ cust_id: c.cust_id, error: toMessage(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, results }), { headers: { "Content-Type": "application/json" }});
  } catch (e) {
    // Return **clear** error text, not [object Object]
    return new Response(JSON.stringify({ ok: false, error: toMessage(e) }), { status: 500 });
  }
});
