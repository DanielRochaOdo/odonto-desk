import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getSupabaseClient, requireUser } from "../_shared/supabase.ts";

const CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = CODE_LENGTH) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[array[i] % CODE_ALPHABET.length];
  }
  return code;
}

async function generateUniqueCode(supabase: any) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return code;
    }
  }

  throw new Error("Unable to generate unique code.");
}

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

    const rateLimit = await enforceRateLimit(
      supabase,
      user.id,
      "create_session",
      5,
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

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const code = await generateUniqueCode(supabase);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        code,
        created_by: user.id,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const { error: participantError } = await supabase
      .from("session_participants")
      .insert({
        session_id: session.id,
        user_id: user.id,
        role: "client",
      });

    if (participantError) {
      throw new Error(participantError.message);
    }

    const { error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: session.id,
        actor_user_id: user.id,
        event_type: "created",
        meta: { code },
      });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        code: session.code,
        status: session.status,
        expiresAt: session.expires_at,
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
