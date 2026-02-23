import { useEffect, useRef } from "react";

export default function VideoStage({
  title,
  stream,
  cursor,
  onPointerMove,
  placeholder,
  mirrored = false,
  muted = false,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">{title}</h2>
        {stream ? (
          <span className="badge bg-teal/20 text-teal">Online</span>
        ) : (
          <span className="badge bg-white/10 text-mist/60">Aguardando</span>
        )}
      </div>
      <div
        className="relative rounded-2xl overflow-hidden bg-ink/70 border border-white/10 aspect-video"
        onPointerMove={onPointerMove}
      >
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={`w-full h-full object-contain ${mirrored ? "scale-x-[-1]" : ""}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-mist/60 text-sm">
            {placeholder}
          </div>
        )}
        {cursor && (
          <div
            className="absolute h-4 w-4 rounded-full bg-coral shadow-lg"
            style={{
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>
    </div>
  );
}
