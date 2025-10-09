// supabase/functions/merge-duplicates/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("FUNCTION_SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("FUNCTION_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false } });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "content-type": "application/json",
};

function normPhone(p?: string | null) {
  if (!p) return null;
  const d = (p as string).replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === "1") return `+${d}`;
  return p.startsWith("+") ? p : (d ? `+${d}` : null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, error:"Method Not Allowed" }), { status:405, headers: CORS });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok:false, error:"Invalid JSON" }), { status:400, headers: CORS }); }

  const phone = normPhone(body?.phone || null);
  const perk  = (body?.perk_code || "FACIAL_CREDIT") as string; // ordering hint only
  if (!phone) return new Response(JSON.stringify({ ok:false, error:"phone required" }), { status:400, headers: CORS });

  // Find all cust_ids for this phone, ordered by balance desc then recency
  const { data: rows, error: qErr } = await db
    .rpc("get_dupe_candidates", { p_phone: phone, p_perk_code: perk })
    .select(); // in case you don’t have this RPC yet, we’ll fallback below

  let list: Array<{ cust_id: string; bal: number; updated_at: string }> = [];
  if (!qErr && Array.isArray(rows) && rows.length) {
    list = rows as any;
  } else {
    // Fallback: inline query via views you have
    const { data: guess, error: guessErr } = await db.rpc("exec_sql", {
      // optional helper; if you don't have exec_sql, replace with from() calls below
      p_sql: `
        select c.cust_id, coalesce(b.balance,0)::float8 as bal, c.updated_at
        from public.contacts c
        left join public.v_entitlements_balance b
          on b.cust_id = c.cust_id and b.perk_code = '${perk}'
        where c.phone = '${phone}'
        order by bal desc, c.updated_at desc
      `
    });

    // If you don’t have exec_sql helper, do the equivalent with two calls:
    // const { data: byPhone } = await db.from('contacts').select('cust_id,updated_at').eq('phone', phone);
    // For each cust_id, get balance from v_entitlements_balance (perk), then sort in JS.

    list = (guess as any) || [];
    if (guessErr) {
      // As a final fallback, just pick the most recent contact as primary.
      const { data: byPhone } = await db.from("contacts").select("cust_id,updated_at").eq("phone", phone).order("updated_at", { ascending:false });
      list = (byPhone || []).map((r:any) => ({ cust_id: r.cust_id, bal: 0, updated_at: r.updated_at }));
    }
  }

  if (!list.length) return new Response(JSON.stringify({ ok:true, merged:0, note:"no contacts for phone" }), { headers: CORS });

  const primary = list[0].cust_id;
  const rest    = [...new Set(list.map(r => r.cust_id))].filter(id => id !== primary);
  let merged = 0;
  for (const dup of rest) {
    const { error: mErr } = await db.rpc("merge_contacts", { p_primary: primary, p_duplicate: dup, p_keep_phone: true });
    if (!mErr) merged++;
  }

  return new Response(JSON.stringify({ ok:true, phone, primary, merged, duplicates: rest.length }), { headers: CORS });
});
