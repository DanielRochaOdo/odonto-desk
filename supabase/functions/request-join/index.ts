import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getSupabaseClient, requireUser } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabaseClient(req.headers.get("Authorization"));
    const user = await requireUser(supabase);
    const body = await req.json();
    const code = String(body?.code ?? "").trim().toUpperCase();

    if (!code) {
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = await enforceRateLimit(
      supabase,
      user.id,
      "request_join",
      10,
      60,
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, status, expires_at, created_by")
      .eq("code", code)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "session_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.created_by === user.id) {
      return new Response(JSON.stringify({ error: "cannot_join_own_session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "pending") {
      return new Response(JSON.stringify({ error: "session_not_pending" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "session_expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRequest } = await supabase
      .from("session_requests")
      .select("id, status")
      .eq("session_id", session.id)
      .eq("requester_user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({
          requestId: existingRequest.id,
          sessionId: session.id,
          status: existingRequest.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: request, error: requestError } = await supabase
      .from("session_requests")
      .insert({
        session_id: session.id,
        requester_user_id: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (requestError) {
      throw new Error(requestError.message);
    }

    const { error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: session.id,
        actor_user_id: user.id,
        event_type: "join_requested",
        meta: {},
      });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return new Response(
      JSON.stringify({
        requestId: request.id,
        sessionId: session.id,
        status: request.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
