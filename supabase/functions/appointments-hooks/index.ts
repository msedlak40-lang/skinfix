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
    const url = new URL(req.url);
    const path = url.pathname;
    const token = url.searchParams.get("token")?.trim() || "";
    const note  = url.searchParams.get("note")?.trim() || null;

    // loose UUID check
    const uuidish = /^[0-9a-fA-F-]{36}$/;

    if (path.endsWith("/appointments/confirm") && req.method === "POST") {
      if (!uuidish.test(token)) return bad("Invalid token");
      const { data, error } = await sb.rpc("confirm_appointment_by_token_rpc", { p_token: token });
      if (error) return bad(error.message);
      return Response.json({ ok: true, appt_id: data });
    }

    if (path.endsWith("/appointments/reschedule") && req.method === "POST") {
      if (!uuidish.test(token)) return bad("Invalid token");
      const { data, error } = await sb.rpc("request_reschedule_by_token_rpc", { p_token: token, p_note: note });
      if (error) return bad(error.message);
      return Response.json({ ok: true, appt_id: data });
    }

    return new Response("Not Found", { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
