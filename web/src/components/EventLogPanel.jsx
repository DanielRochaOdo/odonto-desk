const formatTime = (value) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function EventLogPanel({ events }) {
  return (
    <div className="glass-panel p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Eventos</h2>
        <span className="text-xs text-mist/50">{events.length} registros</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-sm">
        {events.length === 0 && (
          <p className="text-sm text-mist/50">Nenhum evento ainda.</p>
        )}
        {events.map((event) => (
          <div key={event.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{event.event_type}</p>
              {event.meta && Object.keys(event.meta).length > 0 && (
                <p className="text-xs text-mist/50">
                  {JSON.stringify(event.meta)}
                </p>
              )}
            </div>
            <span className="text-xs text-mist/40">{formatTime(event.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
