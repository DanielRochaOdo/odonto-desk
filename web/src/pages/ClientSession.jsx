import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import AcceptModal from "../components/AcceptModal";
import SessionStatusBadge from "../components/SessionStatusBadge";
import { createSession, resolveRequest } from "../lib/sessionApi";
import { supabase } from "../lib/supabaseClient";

export default function ClientSession() {
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!session?.sessionId) return undefined;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from("session_requests")
        .select("*")
        .eq("session_id", session.sessionId)
        .order("created_at", { ascending: false });
      if (data) {
        setRequests(data);
      }
    };

    fetchRequests();

    const channel = supabase
      .channel(`session-requests-${session.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_requests",
          filter: `session_id=eq.${session.sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new, ...prev]);
          }
          if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return undefined;

    const channel = supabase
      .channel(`session-status-${session.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.sessionId}`,
        },
        (payload) => {
          setSession((prev) => (prev ? { ...prev, status: payload.new.status } : prev));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.sessionId]);

  useEffect(() => {
    const pending = requests.find((request) => request.status === "pending");
    setActiveRequest(pending ?? null);
  }, [requests]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await createSession();
      setSession(data);
    } catch (err) {
      setError(err.message ?? "Erro ao criar sessão.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!activeRequest) return;
    await resolveRequest(activeRequest.id, "accept");
    navigate(`/app/session/${session.sessionId}`);
  };

  const handleDeny = async () => {
    if (!activeRequest) return;
    await resolveRequest(activeRequest.id, "deny");
  };

  const requestLabels = useMemo(
    () =>
      requests.map((request) => ({
        ...request,
        requesterLabel: `${request.requester_user_id.slice(0, 8)}...`,
      })),
    [requests],
  );

  return (
    <AppShell title="Sessão do Cliente">
      <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Criar sessão</h2>
            {session && <SessionStatusBadge status={session.status} />}
          </div>
          {!session ? (
            <>
              <p className="text-sm text-mist/70">
                Gere um código de convite e aguarde a solicitação do atendente.
              </p>
              <button type="button" className="btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Gerando..." : "Gerar código"}
              </button>
              {error && <p className="text-sm text-coral">{error}</p>}
            </>
          ) : (
            <div className="space-y-4">
              <div className="glass-panel p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-mist/60">Código da sessão</p>
                  <p className="font-display text-3xl tracking-widest">{session.code}</p>
                </div>
                <div className="text-right text-xs text-mist/60">
                  <p>Expira em</p>
                  <p>{new Date(session.expiresAt).toLocaleTimeString("pt-BR")}</p>
                </div>
              </div>
              <p className="text-sm text-mist/60">
                Compartilhe o código apenas com o atendente autorizado.
              </p>
            </div>
          )}
        </div>
        <div className="glass-panel p-4">
          <h3 className="font-display text-lg mb-4">Solicitações</h3>
          <div className="space-y-3">
            {requestLabels.length === 0 && (
              <p className="text-sm text-mist/60">Nenhuma solicitação ainda.</p>
            )}
            {requestLabels.map((request) => (
              <div key={request.id} className="border border-white/10 rounded-xl p-3">
                <p className="text-sm font-semibold">{request.requesterLabel}</p>
                <p className="text-xs text-mist/60">{request.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <AcceptModal
        open={!!activeRequest}
        request={activeRequest && {
          ...activeRequest,
          requesterLabel: `${activeRequest.requester_user_id.slice(0, 8)}...`,
        }}
        onAccept={handleAccept}
        onDeny={handleDeny}
      />
    </AppShell>
  );
}
