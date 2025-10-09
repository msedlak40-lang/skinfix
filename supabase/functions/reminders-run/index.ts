import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function bad(msg: string, code = 400) { return new Response(msg, { status: code }); }

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET" && path.endsWith("/reminders-run")) {
      const [r24, r3] = await Promise.all([
        sb.rpc("reminders_24h_due_rpc"),
        sb.rpc("reminders_3h_due_rpc"),
      ]);
      if (r24.error) return bad(r24.error.message);
      if (r3.error)  return bad(r3.error.message);
      return Response.json({ ok: true, due24: r24.data ?? [], due3: r3.data ?? [] });
    }

    if (req.method === "POST" && path.endsWith("/reminders-run/send")) {
      const body = await req.json().catch(() => ({}));
      const apptId = (body?.appt_id ?? "").trim();
      const kind = (body?.kind ?? "").trim().toLowerCase(); // "24h" or "3h"
      const channel = (body?.channel ?? "sms").trim().toLowerCase();

      if (!/^[0-9a-fA-F-]{36}$/.test(apptId)) return bad("Invalid appt_id");
      if (!["24h","3h"].includes(kind))      return bad("Invalid kind");
      if (!["sms","email","push"].includes(channel)) return bad("Invalid channel");

      const { error } = await sb.rpc("mark_reminder_sent_rpc", {
        p_appt_id: apptId,
        p_kind: kind,
        p_channel: channel,
      });
      if (error) return bad(error.message);
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
