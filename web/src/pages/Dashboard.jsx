import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { createSession } from "../lib/sessionApi";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (authLoading || !user || loading || session || initialized) return;

    const bootstrap = async () => {
      setInitialized(true);
      setLoading(true);
      setError("");
      try {
        const data = await createSession();
        setSession(data);
      } catch (err) {
        setError(err.message ?? "Erro ao gerar código.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [authLoading, user, loading, session, initialized]);

  return (
    <AppShell title="Painel">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display text-xl mb-2">Cliente</h2>
          <p className="text-sm text-mist/70 mb-4">
            Seu código é fixo por usuário e é gerado automaticamente no login.
          </p>
          {loading && <p className="text-sm text-mist/60">Gerando código...</p>}
          {error && (
            <div className="space-y-3">
              <p className="text-sm text-coral">{error}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSession(null);
                  setInitialized(false);
                }}
                disabled={loading}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {session && (
            <div className="mt-4 space-y-3">
              <div className="glass-panel p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-mist/60">Código fixo</p>
                  <p className="font-display text-3xl tracking-widest">{session.code}</p>
                </div>
                <div className="text-right text-xs text-mist/60">
                  <p>Expira em</p>
                  <p>{new Date(session.expiresAt).toLocaleTimeString("pt-BR")}</p>
                </div>
              </div>
              <Link to="/app/client" className="btn-primary">
                Ver solicitações
              </Link>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="font-display text-xl mb-2">Atendente</h2>
          <p className="text-sm text-mist/70 mb-6">
            Entre com o código fornecido pelo cliente e aguarde a aprovação.
          </p>
          <Link to="/app/agent" className="btn-secondary">
            Entrar com código
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
