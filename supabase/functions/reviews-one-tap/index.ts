import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING     = Deno.env.get("NUDGE_SIGNING_SECRET")!;

const supa = createClient(supabaseUrl, serviceKey);
const te = new TextEncoder();

function b64url(bytes: Uint8Array){
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function b64urlDecode(s: string){
  s = s.replaceAll('-','+').replaceAll('_','/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Uint8Array.from(atob(s + "=".repeat(pad)), c => c.charCodeAt(0));
}
async function hmacBase64Url(data: string){
  const key = await crypto.subtle.importKey("raw", te.encode(SIGNING), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return b64url(new Uint8Array(sig));
}
function html(body: string, status=200) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin:40px;background:#fafafa;color:#0f172a}
    .card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
    .ok{color:#065f46}.warn{color:#991b1b}
  </style>
  <div class="card">${body}</div>`, { headers: { "Content-Type": "text/html; charset=utf-8" }, status });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const t = url.searchParams.get("t");
    if (!t) return html(`<h2 class="warn">Invalid link</h2><p>Missing token.</p>`, 400);
    const [pB64, sigB64] = t.split(".");
    if (!pB64 || !sigB64) return html(`<h2 class="warn">Invalid link</h2><p>Malformed token.</p>`, 400);

    const calc = await hmacBase64Url(pB64);
    if (calc !== sigB64) return html(`<h2 class="warn">Invalid link</h2><p>Signature mismatch.</p>`, 400);

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(pB64))) as { cust_id: string; place_ref?: string; exp: number };
    if (!payload?.cust_id || !payload?.exp) return html(`<h2 class="warn">Invalid link</h2><p>Bad payload.</p>`, 400);
    if (Date.now() / 1000 > payload.exp) return html(`<h2 class="warn">Link expired</h2><p>Please request a new link.</p>`, 410);

    const { error } = await supa.rpc("record_review_posted", {
      p_cust_id: payload.cust_id,
      p_place_ref: payload.place_ref || "google",
    });
    if (error) {
      console.error(error);
      return html(`<h2 class="warn">Something went wrong</h2><p>Please try again later.</p>`, 500);
    }

    return html(`<h2 class="ok">Thank you!</h2><p>Your review was marked as posted.</p>`);
  } catch (e) {
    console.error(e);
    return html(`<h2 class="warn">Unexpected error</h2><p>${String(e)}</p>`, 500);
  }
});
