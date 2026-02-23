const DEFAULT_STUN = "stun:stun.l.google.com:19302";

export const QUALITY_PRESETS = {
  auto: { label: "Auto", maxBitrate: null, frameRate: 30 },
  low: { label: "Baixa", maxBitrate: 400_000, frameRate: 15 },
  medium: { label: "Média", maxBitrate: 1_200_000, frameRate: 24 },
  high: { label: "Alta", maxBitrate: 2_800_000, frameRate: 30 },
};

export function buildIceServers() {
  const stunUrl = import.meta.env.VITE_STUN_URL || DEFAULT_STUN;
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const iceServers = [{ urls: stunUrl }];
  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

export function createPeerConnection({
  onIceCandidate,
  onTrack,
  onDataChannel,
  onIceConnectionState,
  onConnectionState,
}) {
  const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    onTrack?.(event);
  };

  pc.ondatachannel = (event) => {
    onDataChannel?.(event.channel);
  };

  pc.oniceconnectionstatechange = () => {
    onIceConnectionState?.(pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    onConnectionState?.(pc.connectionState);
  };

  return pc;
}

export async function applyQualityToTrack(track, qualityKey) {
  const preset = QUALITY_PRESETS[qualityKey] ?? QUALITY_PRESETS.auto;
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({ frameRate: preset.frameRate });
  } catch (_error) {
    // Best-effort only.
  }
}

export async function setSenderMaxBitrate(sender, maxBitrate) {
  if (!sender || maxBitrate == null) return;
  const parameters = sender.getParameters();
  if (!parameters.encodings) {
    parameters.encodings = [{}];
  }
  parameters.encodings[0].maxBitrate = maxBitrate;
  await sender.setParameters(parameters);
}

export function computeAutoBitrate(metrics) {
  if (!metrics) return null;
  const { packetLoss, rttMs } = metrics;

  if (packetLoss > 0.08 || rttMs > 400) return QUALITY_PRESETS.low.maxBitrate;
  if (packetLoss > 0.03 || rttMs > 250) return QUALITY_PRESETS.medium.maxBitrate;
  return QUALITY_PRESETS.high.maxBitrate;
}

export function startStatsLoop(pc, role, onMetrics, intervalMs = 1500) {
  let previous = null;
  const timer = setInterval(async () => {
    if (!pc) return;
    const stats = await pc.getStats();
    const metrics = extractMetrics(stats, previous, role);
    previous = metrics?.raw ?? previous;
    if (metrics) onMetrics(metrics);
  }, intervalMs);

  return () => clearInterval(timer);
}

function extractMetrics(stats, previous, role) {
  let outbound;
  let inbound;
  let candidatePair;

  stats.forEach((report) => {
    if (report.type === "outbound-rtp" && report.kind === "video") {
      outbound = report;
    }
    if (report.type === "inbound-rtp" && report.kind === "video") {
      inbound = report;
    }
    if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
      candidatePair = report;
    }
  });

  const now = Date.now();
  const prevTimestamp = previous?.timestamp ?? now;
  const elapsedSeconds = Math.max(0.001, (now - prevTimestamp) / 1000);

  const bytes = role === "client" ? outbound?.bytesSent : inbound?.bytesReceived;
  const prevBytes = previous?.bytes ?? bytes ?? 0;
  const bitrateKbps = bytes != null ? ((bytes - prevBytes) * 8) / 1000 / elapsedSeconds : 0;

  const packetsLost = inbound?.packetsLost ?? 0;
  const packetsReceived = inbound?.packetsReceived ?? 0;
  const packetLoss =
    packetsReceived + packetsLost > 0 ? packetsLost / (packetsReceived + packetsLost) : 0;

  const rttMs = candidatePair?.currentRoundTripTime
    ? candidatePair.currentRoundTripTime * 1000
    : 0;

  const jitterMs = inbound?.jitter ? inbound.jitter * 1000 : 0;
  const framesDropped = inbound?.framesDropped ?? 0;

  return {
    bitrateKbps: Math.round(bitrateKbps),
    packetLoss,
    rttMs: Math.round(rttMs),
    jitterMs: Math.round(jitterMs),
    framesDropped,
    raw: { timestamp: now, bytes },
  };
}
