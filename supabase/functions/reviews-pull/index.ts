// supabase/functions/reviews-pull/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type IncomingReview = {
  platform: "google";
  place_ref: string;
  external_review_id: string;
  published_at: string; // ISO
  rating?: number | null;
  permalink?: string | null;
  text?: string | null;
  author_display?: string | null;
};

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_PLACE_ID = Deno.env.get("GOOGLE_PLACE_ID") || null;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function ingestOne(r: IncomingReview) {
  const { error } = await sb.rpc("ingest_external_review_rpc", {
    p_platform: r.platform,
    p_place_ref: r.place_ref,
    p_external_review_id: r.external_review_id,
    p_published_at: r.published_at,
    p_rating: r.rating ?? null,
    p_permalink: r.permalink ?? null,
    p_text: r.text ?? null,
    p_author_display: r.author_display ?? null,
  });
  if (error) throw error;
}

async function handleWebhook(req: Request) {
  const body = (await req.json()) as { reviews: IncomingReview[] };
  const list = Array.isArray(body?.reviews) ? body.reviews : [];
  let ok = 0, errors: string[] = [];
  for (const r of list) {
    try { await ingestOne(r); ok++; }
    catch (e) { errors.push(`${r.external_review_id}: ${e?.message ?? e}`); }
  }
  return Response.json({ ok, errors });
}

// NEW: user-confirm endpoint using review token (?token=UUID)
async function handleConfirm(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) return new Response("Missing token", { status: 400 });

  // loose UUID format check
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
    return new Response("Invalid token format", { status: 400 });
  }

  const { error } = await sb.rpc("mark_review_user_confirmed_rpc", { p_token: token });
  if (error) {
    // our RPC now raises 'Unknown token' when not found
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

// On GET, run a retry-attribute sweep for the last 14 days
async function handleScheduled(): Promise<Response> {
  const sinceISO = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await sb.rpc("retry_review_attribution_rpc", {
    p_place_ref: GOOGLE_PLACE_ID, // may be null; function handles it
    p_since: sinceISO,
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, attributed: data ?? 0 });
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/reviews-pull/confirm") && req.method === "POST") {
      return await handleConfirm(req);
    }

    if (path.endsWith("/reviews-pull") && req.method === "POST") {
      return await handleWebhook(req);
    }

    // Treat GETs as scheduled retry sweeps
    if (req.method === "GET" && path.endsWith("/reviews-pull")) {
      return await handleScheduled();
    }

    return new Response("Not Found", { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});
