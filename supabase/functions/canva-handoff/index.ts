import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function bad(msg: string, code = 400) {
  return new Response(msg, { status: code });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Not Found", { status: 404 });
    const body = await req.json().catch(() => ({}));

    const cust_id = (body?.cust_id ?? "").trim();
    const expires = Number(body?.expires ?? 600); // seconds (10 min default)

    if (!/^[0-9a-fA-F-]{36}$/.test(cust_id)) return bad("Invalid cust_id");

    // Get best before/after paths from RPC
    const { data, error } = await sb.rpc("get_best_before_after_rpc", { p_cust_id: cust_id });
    if (error) return bad(error.message);
    if (!data || data.length === 0) return bad("No assets found for this customer", 404);

    const row = Array.isArray(data) ? data[0] : data;

    const sign = async (path?: string | null) => {
      if (!path) return null;
      const objectPath = path.replace(/^media\//, "");
      const { data: s, error: e } = await sb.storage.from("media").createSignedUrl(objectPath, expires);
      if (e) throw new Error(e.message);
      return s.signedUrl;
    };

    const beforeUrl = await sign(row.before_path);
    const afterUrl  = await sign(row.after_path);

    // It’s okay if only one side exists; return what we have
    return Response.json({
      ok: true,
      cust_id,
      initials: row.initials,
      expires_in: expires,
      before: beforeUrl ? { url: beforeUrl, path: row.before_path, taken_at: row.before_ts } : null,
      after:  afterUrl  ? { url: afterUrl,  path: row.after_path,  taken_at: row.after_ts  } : null,
      // room for brand text, colors, etc. later
    });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
