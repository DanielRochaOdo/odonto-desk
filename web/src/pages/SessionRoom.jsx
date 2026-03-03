import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import ChatPanel from "../components/ChatPanel";
import EventLogPanel from "../components/EventLogPanel";
import LoadingScreen from "../components/LoadingScreen";
import MetricsBar from "../components/MetricsBar";
import SessionStatusBadge from "../components/SessionStatusBadge";
import VideoStage from "../components/VideoStage";
import { useAuth } from "../lib/auth";
import { logEvent, sendMessage, sendSignal } from "../lib/sessionApi";
import { supabase } from "../lib/supabaseClient";
import {
  QUALITY_PRESETS,
  applyQualityToTrack,
  computeAutoBitrate,
  createPeerConnection,
  setSenderMaxBitrate,
  startStatsLoop,
} from "../lib/webrtc";

export default function SessionRoom() {
  const { id: sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [iceState, setIceState] = useState("new");
  const [quality, setQuality] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [shareError, setShareError] = useState("");
  const [sharePending, setSharePending] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [remoteCursor, setRemoteCursor] = useState(null);
  const pcRef = useRef(null);
  const senderRef = useRef(null);
  const dataChannelRef = useRef(null);
  const lastCursorSentAt = useRef(0);
  const lastAutoBitrate = useRef(null);
  const lastRestartAt = useRef(0);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data: sessionData, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

      if (error || !sessionData) {
        navigate("/app", { replace: true });
        return;
      }

      const { data: participant } = await supabase
        .from("session_participants")
        .select("role")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (mounted) {
        setSession(sessionData);
        setRole(participant?.role ?? null);
        setLoading(false);
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, [sessionId, user.id, navigate]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const channel = supabase
      .channel(`session-updates-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("session_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    loadMessages();

    const channel = supabase
      .channel(`session-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const loadEvents = async () => {
      const { data } = await supabase
        .from("session_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (data) setEvents(data);
    };

    loadEvents();

    const channel = supabase
      .channel(`session-events-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!role || pcRef.current) return undefined;

    const pc = createPeerConnection({
      onIceCandidate: (candidate) => {
        sendSignal(sessionId, user.id, "ice", { candidate });
      },
      onTrack: (event) => {
        setRemoteStream(event.streams[0]);
      },
      onDataChannel: (channel) => {
        setupDataChannel(channel);
      },
      onIceConnectionState: (state) => {
        setIceState(state);
        if (state === "failed" || state === "disconnected") {
          if (role === "client") {
            const now = Date.now();
            if (now - lastRestartAt.current > 5000) {
              lastRestartAt.current = now;
              restartIce();
            }
          }
        }
      },
    });

    pcRef.current = pc;

    const stopStats = startStatsLoop(pc, role, setMetrics);

    if (role === "client") {
      const channel = pc.createDataChannel("control", { ordered: true });
      setupDataChannel(channel);
    }

    return () => {
      stopStats();
      pc.close();
      pcRef.current = null;
    };
  }, [role, sessionId, user.id]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const syncSignals = async () => {
      const { data } = await supabase
        .from("session_signals")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      data?.forEach((signal) => {
        if (signal.from_user_id === user.id) return;
        handleSignal(signal);
      });
    };

    syncSignals();

    const channel = supabase
      .channel(`signals-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_signals",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new.from_user_id === user.id) return;
          handleSignal(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, user.id]);

  useEffect(() => {
    if (quality === "auto") return;
    const sender = senderRef.current;
    if (!sender?.track) return;
    applyQualityToTrack(sender.track, quality);
    setSenderMaxBitrate(sender, QUALITY_PRESETS[quality].maxBitrate);
  }, [quality]);

  useEffect(() => {
    if (quality !== "auto") return;
    const sender = senderRef.current;
    if (!sender) return;
    const target = computeAutoBitrate(metrics);
    if (!target || target === lastAutoBitrate.current) return;
    lastAutoBitrate.current = target;
    setSenderMaxBitrate(sender, target);
  }, [metrics, quality]);

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "cursor") {
          setRemoteCursor({ x: message.x, y: message.y });
        }
      } catch (_error) {
        // ignore
      }
    };
  };

  const startScreenShare = async () => {
    if (sharePending) return;
    setShareError("");
    const pc = pcRef.current;
    if (!pc) {
      setShareError("Conexao WebRTC nao pronta. Tente novamente.");
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      const message = window.isSecureContext
        ? "Seu navegador nao suporta compartilhamento de tela."
        : "Compartilhamento exige HTTPS ou localhost.";
      setShareError(message);
      await logEvent(sessionId, user.id, "share_failed", { message });
      return;
    }

    try {
      setSharePending(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });

      setLocalStream(stream);
      const [track] = stream.getVideoTracks();
      await applyQualityToTrack(track, quality);
      const sender = pc.addTrack(track, stream);
      senderRef.current = sender;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(sessionId, user.id, "offer", offer);

      stream.getTracks().forEach((t) => {
        t.onended = () => {
          endSession();
        };
      });
    } catch (error) {
      const message = error?.message ?? "Falha ao compartilhar a tela.";
      setShareError(message);
      await logEvent(sessionId, user.id, "share_failed", { message });
    } finally {
      setSharePending(false);
    }
  };

  const handleSignal = async (signal) => {
    const pc = pcRef.current;
    if (!pc) return;

    if (signal.type === "offer") {
      await pc.setRemoteDescription(signal.payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(sessionId, user.id, "answer", answer);
    }

    if (signal.type === "answer") {
      await pc.setRemoteDescription(signal.payload);
    }

    if (signal.type === "ice" && signal.payload?.candidate) {
      try {
        await pc.addIceCandidate(signal.payload.candidate);
      } catch (_error) {
        // ignore
      }
    }
  };

  const restartIce = async () => {
    if (role !== "client") return;
    const pc = pcRef.current;
    if (!pc) return;
    lastRestartAt.current = Date.now();
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    await sendSignal(sessionId, user.id, "offer", offer);
  };

  const endSession = async () => {
    await supabase.from("sessions").update({ status: "ended" }).eq("id", sessionId);
    await logEvent(sessionId, user.id, "ended", {});
    pcRef.current?.close();
    navigate("/app");
  };

  const sendCursor = (event) => {
    if (role !== "agent") return;
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") return;
    const now = Date.now();
    if (now - lastCursorSentAt.current < 40) return;
    lastCursorSentAt.current = now;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setCursor({ x, y });
    dataChannelRef.current.send(
      JSON.stringify({ type: "cursor", x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) }),
    );
  };

  const messageList = useMemo(
    () =>
      messages.map((msg) => ({
        ...msg,
        userLabel: msg.user_id === user.id ? "VocÃª" : `${msg.user_id.slice(0, 8)}...`,
      })),
    [messages, user.id],
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (!role) {
    return (
      <AppShell title="SessÃ£o pendente">
        <div className="card">
          <h2 className="font-display text-xl mb-2">Aguardando permissÃ£o</h2>
          <p className="text-sm text-mist/70 mb-4">
            VocÃª ainda nÃ£o Ã© participante desta sessÃ£o. Aguarde o aceite do cliente.
          </p>
          <button type="button" className="btn-secondary" onClick={() => navigate("/app")}>
            Voltar ao painel
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="SessÃ£o ativa"
      actions={
        <div className="flex items-center gap-3">
          <SessionStatusBadge status={session?.status ?? "pending"} />
          <button
            type="button"
            className="btn-secondary"
            onClick={restartIce}
            disabled={role !== "client"}
          >
            Reconectar
          </button>
          <button type="button" className="btn-danger" onClick={endSession}>
            Encerrar
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <MetricsBar metrics={metrics} iceState={iceState} quality={quality} onQualityChange={setQuality} />
        <div className="grid xl:grid-cols-[1.5fr_0.5fr] gap-6">
          <div className="space-y-6">
            {role === "client" && !localStream && (
              <div className="glass-panel p-4 space-y-3">
                <p className="text-sm text-mist/70">
                  Clique para iniciar o compartilhamento da sua tela.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startScreenShare}
                  disabled={sharePending}
                >
                  {sharePending ? "Iniciando..." : "Iniciar compartilhamento"}
                </button>
                {shareError && <p className="text-sm text-coral">{shareError}</p>}
              </div>
            )}
            <VideoStage
              title={role === "client" ? "Tela do Cliente (vocÃª)" : "Tela do Cliente"}
              stream={role === "client" ? localStream : remoteStream}
              cursor={role === "client" ? remoteCursor : cursor}
              onPointerMove={role === "agent" ? sendCursor : undefined}
              placeholder="Aguardando compartilhamento de tela"
              muted={role === "client"}
            />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-4">
                <p className="text-xs text-mist/60">Role</p>
                <p className="font-semibold capitalize">{role}</p>
              </div>
              <div className="glass-panel p-4">
                <p className="text-xs text-mist/60">SessÃ£o</p>
                <p className="font-semibold">{sessionId.slice(0, 8)}...</p>
              </div>
            </div>
          </div>
          <div className="grid gap-6">
            <ChatPanel
              messages={messageList}
              onSend={(text) => sendMessage(sessionId, text, user.id)}
            />
            <EventLogPanel events={events} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

