import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

function getProjectRef() {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function getLocalSession() {
  const projectRef = getProjectRef();
  if (!projectRef) return null;
  const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isSessionExpired(session) {
  if (!session?.expires_at) return true;
  return Date.now() >= Number(session.expires_at) * 1000;
}

async function getAccessToken() {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("VITE_SUPABASE_ANON_KEY nao configurada.");
  }
  if (!SUPABASE_URL) {
    throw new Error("VITE_SUPABASE_URL nao configurada.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data?.session?.access_token;
  if (token) return token;

  const localSession = getLocalSession();
  if (localSession && !isSessionExpired(localSession)) {
    return localSession.access_token;
  }

  throw new Error("Sessao invalida. Faca login novamente.");
}

async function invokeFunction(functionName, body) {
  const token = await getAccessToken();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (payload && (payload.error || payload.message)) ||
      `Erro ao chamar ${functionName}: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function createSession() {
  return invokeFunction("create-session");
}

export async function requestJoin(code) {
  return invokeFunction("request-join", { code });
}

export async function resolveRequest(requestId, action) {
  return invokeFunction("resolve-request", { requestId, action });
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
