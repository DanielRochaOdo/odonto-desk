import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import SessionStatusBadge from "../components/SessionStatusBadge";
import { requestJoin } from "../lib/sessionApi";
import { supabase } from "../lib/supabaseClient";

export default function AgentSession() {
  const [code, setCode] = useState("");
  const [requestInfo, setRequestInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!requestInfo?.requestId) return undefined;

    let isActive = true;
    const pollStatus = async () => {
      const { data, error } = await supabase
        .from("session_requests")
        .select("id, status, session_id")
        .eq("id", requestInfo.requestId)
        .maybeSingle();

      if (!isActive || error || !data) return;

      if (data.status === "accepted") {
        navigate(`/app/session/${data.session_id}`);
      }
      setRequestInfo((prev) => (prev ? { ...prev, status: data.status } : prev));
    };

    pollStatus();
    const intervalId = setInterval(pollStatus, 3000);

    const channel = supabase
      .channel(`join-request-${requestInfo.requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_requests",
          filter: `id=eq.${requestInfo.requestId}`,
        },
        (payload) => {
          if (payload.new.status === "accepted") {
            navigate(`/app/session/${requestInfo.sessionId}`);
          }
          setRequestInfo((prev) => (prev ? { ...prev, status: payload.new.status } : prev));
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [requestInfo?.requestId, requestInfo?.sessionId, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await requestJoin(code);
      setRequestInfo(data);
    } catch (err) {
      setError(err.message ?? "Erro ao solicitar acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Sessão do Atendente">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Entrar com código</h2>
            {requestInfo && <SessionStatusBadge status={requestInfo.status} />}
          </div>
          {!requestInfo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                className="input"
                placeholder="Digite o código"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                required
              />
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar acesso"}
              </button>
              {error && <p className="text-sm text-coral">{error}</p>}
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-mist/70">
                Solicitação enviada. Aguarde a autorização do cliente para
                iniciar o compartilhamento.
              </p>
              <div className="glass-panel p-4">
                <p className="text-xs text-mist/60">Status</p>
                <p className="font-semibold">{requestInfo.status}</p>
              </div>
              {requestInfo.status === "denied" && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setRequestInfo(null);
                    setCode("");
                  }}
                >
                  Tentar outro código
                </button>
              )}
            </div>
          )}
        </div>
        <div className="glass-panel p-4 space-y-3">
          <h3 className="font-display text-lg">Boas práticas</h3>
          <ul className="text-sm text-mist/60 space-y-2">
            <li>Sempre explique o que será feito antes de aceitar.</li>
            <li>Use o chat para confirmar cada etapa.</li>
            <li>Encerrar a sessão quando o suporte terminar.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
