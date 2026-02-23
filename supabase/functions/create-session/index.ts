import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getSupabaseClient, requireUser } from "../_shared/supabase.ts";

const CODE_DIGITS = 8;
const textEncoder = new TextEncoder();

function formatNumericCode(value: bigint) {
  const mod = 10n ** BigInt(CODE_DIGITS);
  const numeric = (value % mod).toString().padStart(CODE_DIGITS, "0");
  return numeric;
}

async function generateCodeForUser(userId: string, attempt: number) {
  const secret = Deno.env.get("SESSION_CODE_SECRET");
  if (!secret) {
    throw new Error("Missing SESSION_CODE_SECRET");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = `${userId}:${attempt}`;
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  const bytes = new Uint8Array(signature);

  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value = (value << 8n) + BigInt(bytes[i]);
  }

  return formatNumericCode(value);
}

async function getOrCreateUserCode(supabase: any, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("user_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.code) {
    return existing.code;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = await generateCodeForUser(userId, attempt);
    const { data, error } = await supabase
      .from("user_codes")
      .insert({ user_id: userId, code })
      .select("code")
      .single();

    if (!error && data?.code) {
      return data.code;
    }

    if (error?.code !== "23505") {
      throw new Error(error?.message ?? "Unable to allocate code.");
    }
  }

  throw new Error("Unable to allocate unique code.");
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
    const code = await getOrCreateUserCode(supabase, user.id);

    const { data: existingSession, error: existingSessionError } = await supabase
      .from("sessions")
      .select("id, code, status, expires_at")
      .eq("created_by", user.id)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      throw new Error(existingSessionError.message);
    }

    if (existingSession) {
      const isExpired = new Date(existingSession.expires_at).getTime() <= Date.now();
      if (!isExpired) {
        return new Response(
          JSON.stringify({
            sessionId: existingSession.id,
            code: existingSession.code,
            status: existingSession.status,
            expiresAt: existingSession.expires_at,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: expireError } = await supabase
        .from("sessions")
        .update({ status: "ended" })
        .eq("id", existingSession.id);

      if (expireError) {
        throw new Error(expireError.message);
      }
    }

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
