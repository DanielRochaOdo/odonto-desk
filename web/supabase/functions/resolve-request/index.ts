import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
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
    const requestId = String(body?.requestId ?? "").trim();
    const action = String(body?.action ?? "").trim().toLowerCase();

    if (!requestId || !["accept", "deny"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: requestError } = await supabase
      .from("session_requests")
      .select(
        "id, session_id, requester_user_id, status, session:sessions ( id, created_by, status, expires_at )",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !request) {
      return new Response(JSON.stringify({ error: "request_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!request.session || request.session.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.status !== "pending") {
      return new Response(JSON.stringify({ error: "already_resolved" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(request.session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "session_expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextStatus = action === "accept" ? "accepted" : "denied";

    const { error: updateError } = await supabase
      .from("session_requests")
      .update({
        status: nextStatus,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (action === "accept") {
      const { error: participantError } = await supabase
        .from("session_participants")
        .upsert(
          {
            session_id: request.session_id,
            user_id: request.requester_user_id,
            role: "agent",
          },
          { onConflict: "session_id,user_id" },
        );

      if (participantError) {
        throw new Error(participantError.message);
      }

      const { error: sessionError } = await supabase
        .from("sessions")
        .update({ status: "active" })
        .eq("id", request.session_id);

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const { error: eventError } = await supabase
        .from("session_events")
        .insert({
          session_id: request.session_id,
          actor_user_id: user.id,
          event_type: "accepted",
          meta: { requesterUserId: request.requester_user_id },
        });

      if (eventError) {
        throw new Error(eventError.message);
      }
    }

    if (action === "deny") {
      const { error: sessionError } = await supabase
        .from("sessions")
        .update({ status: "denied" })
        .eq("id", request.session_id);

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const { error: eventError } = await supabase
        .from("session_events")
        .insert({
          session_id: request.session_id,
          actor_user_id: user.id,
          event_type: "denied",
          meta: { requesterUserId: request.requester_user_id },
        });

      if (eventError) {
        throw new Error(eventError.message);
      }
    }

    return new Response(
      JSON.stringify({
        requestId,
        status: nextStatus,
        sessionId: request.session_id,
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
