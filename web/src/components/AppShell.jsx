import { useAuth } from "../lib/auth";

export default function AppShell({ title, children, actions }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur border-b border-white/10 bg-ink/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-mist/60">Acesso Remoto</p>
            <h1 className="font-display text-2xl font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <div className="text-right">
              <p className="text-xs text-mist/60">Sessão ativa</p>
              <p className="text-sm font-semibold">{user?.email}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={signOut}>
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
