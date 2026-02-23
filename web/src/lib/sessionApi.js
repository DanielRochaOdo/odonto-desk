import { supabase } from "./supabaseClient";

export async function createSession() {
  const { data, error } = await supabase.functions.invoke("create-session");
  if (error) throw error;
  return data;
}

export async function requestJoin(code) {
  const { data, error } = await supabase.functions.invoke("request-join", {
    body: { code },
  });
  if (error) throw error;
  return data;
}

export async function resolveRequest(requestId, action) {
  const { data, error } = await supabase.functions.invoke("resolve-request", {
    body: { requestId, action },
  });
  if (error) throw error;
  return data;
}

export async function sendMessage(sessionId, message, userId) {
  const { error } = await supabase
    .from("session_messages")
    .insert({ session_id: sessionId, user_id: userId, message });
  if (error) throw error;
}

export async function logEvent(sessionId, actorUserId, eventType, meta = {}) {
  const { error } = await supabase.from("session_events").insert({
    session_id: sessionId,
    actor_user_id: actorUserId,
    event_type: eventType,
    meta,
  });
  if (error) throw error;
}

export async function sendSignal(sessionId, fromUserId, type, payload, toUserId = null) {
  const { error } = await supabase.from("session_signals").insert({
    session_id: sessionId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    type,
    payload,
  });
  if (error) throw error;
}
