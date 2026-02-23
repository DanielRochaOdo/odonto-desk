const formatLoss = (loss) => `${Math.round(loss * 100)}%`;

export default function MetricsBar({ metrics, iceState, quality, onQualityChange }) {
  return (
    <div className="glass-panel px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
      <div>
        <p className="text-xs text-mist/60">RTT</p>
        <p className="font-semibold">{metrics?.rttMs ?? 0} ms</p>
      </div>
      <div>
        <p className="text-xs text-mist/60">Bitrate</p>
        <p className="font-semibold">{metrics?.bitrateKbps ?? 0} kbps</p>
      </div>
      <div>
        <p className="text-xs text-mist/60">Perda</p>
        <p className="font-semibold">{formatLoss(metrics?.packetLoss ?? 0)}</p>
      </div>
      <div>
        <p className="text-xs text-mist/60">Jitter</p>
        <p className="font-semibold">{metrics?.jitterMs ?? 0} ms</p>
      </div>
      <div>
        <p className="text-xs text-mist/60">Frames Dropped</p>
        <p className="font-semibold">{metrics?.framesDropped ?? 0}</p>
      </div>
      <div>
        <p className="text-xs text-mist/60">ICE</p>
        <p className="font-semibold capitalize">{iceState}</p>
      </div>
      <div className="ml-auto">
        <label className="text-xs text-mist/60">Qualidade</label>
        <select
          className="input mt-1 text-sm"
          value={quality}
          onChange={(event) => onQualityChange(event.target.value)}
        >
          <option value="auto">Auto</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </div>
    </div>
  );
}
