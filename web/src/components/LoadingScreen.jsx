export default function LoadingScreen({ label = "Carregando..." }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-mist/70">
      <div className="glass-panel px-8 py-6 flex items-center gap-4">
        <div className="h-4 w-4 rounded-full bg-teal animate-pulse" />
        <span className="text-sm tracking-wide">{label}</span>
      </div>
    </div>
  );
}
