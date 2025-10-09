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

    // Accept either asset_id OR path
    const asset_id = (body?.asset_id ?? "").trim();
    const pathIn   = (body?.path ?? "").trim();
    const expires  = Number(body?.expires ?? 300); // seconds, default 5 min

    let path = pathIn;

    // If asset_id provided, fetch path via RPC
    if (!path && asset_id) {
      if (!/^[0-9a-fA-F-]{36}$/.test(asset_id)) return bad("Invalid asset_id");
      const { data, error } = await sb.rpc("get_media_path_rpc", { p_asset_id: asset_id });
      if (error) return bad(error.message);
      if (!data) return bad("Asset not found", 404);
      path = String(data);
    }

    if (!path) return bad("Provide asset_id or path");
    if (!path.startsWith("media/")) return bad("Invalid path");

    const objectPath = path.replace(/^media\//, "");
    const { data, error } = await sb.storage.from("media").createSignedUrl(objectPath, expires);
    if (error) return bad(error.message);

    return Response.json({ ok: true, url: data.signedUrl, expires_in: expires });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
