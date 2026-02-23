import { useState } from "react";

export default function ChatPanel({ messages, onSend, disabled }) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <div className="glass-panel p-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Chat</h2>
        <span className="text-xs text-mist/50">{messages.length} mensagens</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 && (
          <p className="text-sm text-mist/50">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="text-sm">
            <p className="text-mist/50 text-xs">{message.userLabel}</p>
            <p>{message.message}</p>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          className="input flex-1"
          placeholder="Digite uma mensagem"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
        />
        <button type="submit" className="btn-primary" disabled={disabled}>
          Enviar
        </button>
      </form>
    </div>
  );
}
