export default function AcceptModal({ open, request, onAccept, onDeny }) {
  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-40 bg-ink/80 backdrop-blur flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h2 className="font-display text-xl mb-2">Solicitação de acesso</h2>
        <p className="text-sm text-mist/70 mb-6">
          Um atendente solicitou acesso à sua sessão. Você precisa aceitar
          explicitamente para iniciar o compartilhamento.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-mist/50">Solicitante</span>
            <span className="font-semibold">{request.requesterLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-mist/50">Horário</span>
            <span className="font-semibold">
              {new Date(request.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-primary flex-1" onClick={onAccept}>
            Aceitar
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onDeny}>
            Negar
          </button>
        </div>
      </div>
    </div>
  );
}
