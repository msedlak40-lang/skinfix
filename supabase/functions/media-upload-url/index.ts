import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function bad(msg: string, code = 400) {
  return new Response(msg, { status: code });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Not Found", { status: 404 });
    const body = await req.json().catch(() => ({}));
    const cust_id: string = (body?.cust_id ?? "").trim();
    const type: string = (body?.type ?? "").trim().toLowerCase();    // 'before' | 'after' | 'other'
    const ext: string  = (body?.ext ?? "").trim().toLowerCase();     // 'jpg' | 'png' | ...

    // Validate
    const uuidish = /^[0-9a-fA-F-]{36}$/;
    if (!uuidish.test(cust_id)) return bad("Invalid cust_id");
    if (!["before","after","other"].includes(type)) return bad("Invalid type");
    if (!["jpg","jpeg","png","heic","webp"].includes(ext)) return bad("Invalid ext");

    // ^ Above won't see app.contacts; instead, we rely on the RPC to error if bad cust_id.
    // (Keep for future if you expose a public view.)

    // Create DB row + storage path via RPC
    const { data: created, error: rpcErr } = await sb.rpc("create_media_asset_rpc", {
      p_cust_id: cust_id,
      p_type: type,
      p_ext: ext,
    });
    if (rpcErr) return bad(rpcErr.message);

    const asset_id: string = created.asset_id ?? created[0]?.asset_id;
    const path: string = created.path ?? created[0]?.path;
    if (!asset_id || !path) return bad("Failed to create asset record");

    // Mint signed upload URL (valid 1 minute)
    const { data: signed, error: signErr } = await sb.storage
      .from("media")
      .createSignedUploadUrl(path.replace(/^media\//, ""), 60);
    if (signErr) return bad(signErr.message);

    // Return everything the client needs
    return Response.json({
      ok: true,
      asset_id,
      path,                   // e.g., media/<cust>/<asset>.jpg
      signedUrl: signed.signedUrl, // PUT this URL with file bytes
      token: signed.token,          // if using supabase-js uploadToSignedUrl
      expires_in: 60
    });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
