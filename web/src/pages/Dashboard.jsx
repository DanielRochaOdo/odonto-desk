import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

export default function Dashboard() {
  return (
    <AppShell title="Painel">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display text-xl mb-2">Cliente</h2>
          <p className="text-sm text-mist/70 mb-6">
            Gere um código e aguarde a solicitação do atendente para iniciar o
            compartilhamento da tela.
          </p>
          <Link to="/app/client" className="btn-primary">
            Criar sessão
          </Link>
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
