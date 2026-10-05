import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Peer from "peerjs";
import type { MediaConnection } from "peerjs";
import { supabase } from "@/integrations/supabase/client";
import { playAttentionSound, unlockAttentionSound } from "@/lib/attention-alert";

export type Member = {
  user_id: string;
  name: string;
  avatar: string | null;
  peer_id: string | null;
  cam_on: boolean;
  mic_on: boolean;
  raised_hand?: boolean;
};

export type RemoteParticipant = {
  peerId: string;
  stream: MediaStream;
};

export type AttentionAlert = {
  id: string;
  fromName: string;
};

type AttentionPayload = {
  id?: unknown;
  fromUserId?: unknown;
  fromName?: unknown;
  targetUserId?: unknown;
};

export type MediaDeviceInfoItem = {
  deviceId: string;
  label: string;
};

type Me = { id: string; name: string; avatar: string | null };

export type ConnectionStatus = "connecting" | "connected" | "unstable" | "reconnecting";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

export const MAX_PARTICIPANTS = 10;

export function useRoomSession(roomId: string, me: Me | null, accessGranted = true) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttKey, setPttKey] = useState<string>("Insert");
  const [pttActive, setPttActive] = useState(false);
  const [attentionAlert, setAttentionAlert] = useState<AttentionAlert | null>(null);
  const [attentionCooldown, setAttentionCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [raisedHand, setRaisedHand] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [reconnectTick, setReconnectTick] = useState(0);

  // Dispositivos identificados no navegador (Tablets, Celulares e Notebooks)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfoItem[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfoItem[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const inCallRef = useRef(false);
  const attentionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attentionCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttentionReceivedRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  const micLive = micOn && (!pushToTalk || pttActive);

  useEffect(() => {
    const cameraPreference = window.localStorage.getItem("nexo-camera-on");
    const microphonePreference = window.localStorage.getItem("nexo-microphone-on");
    if (cameraPreference !== null) setCamOn(cameraPreference === "true");
    if (microphonePreference !== null) setMicOn(microphonePreference === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("nexo-camera-on", String(camOn));
  }, [camOn]);

  useEffect(() => {
    window.localStorage.setItem("nexo-microphone-on", String(micOn));
  }, [micOn]);

  /* ---------- Identifica Câmeras e Microfones disponíveis no Tablet/Navegador ---------- */
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vDevs: MediaDeviceInfoItem[] = [];
      const aDevs: MediaDeviceInfoItem[] = [];

      devices.forEach((d) => {
        if (d.kind === "videoinput") {
          vDevs.push({
            deviceId: d.deviceId,
            label: d.label || `Câmera ${vDevs.length + 1}`,
          });
        } else if (d.kind === "audioinput") {
          aDevs.push({
            deviceId: d.deviceId,
            label: d.label || `Microfone ${aDevs.length + 1}`,
          });
        }
      });

      setVideoDevices(vDevs);
      setAudioDevices(aDevs);

      const firstVideo = vDevs[0];
      const firstAudio = aDevs[0];
      if (firstVideo && !selectedVideoDeviceId) {
        setSelectedVideoDeviceId(firstVideo.deviceId);
      }
      if (firstAudio && !selectedAudioDeviceId) {
        setSelectedAudioDeviceId(firstAudio.deviceId);
      }
    } catch (e) {
      console.warn("Não foi possível listar dispositivos de mídia:", e);
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  useEffect(() => {
    void refreshDevices();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return undefined;
    }
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [refreshDevices]);

  /* ---------- presence ---------- */
  useEffect(() => {
    if (!me || !roomId || !accessGranted) return;
    // Canal compartilhado por sala: todos na mesma sala precisam do MESMO nome de canal
    const channelName = `room-presence-${roomId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Member>();
        const list: Member[] = [];
        for (const entries of Object.values(state)) {
          const entry = entries[entries.length - 1];
          if (entry) list.push(entry);
        }
        setMembers(list);
      })
      .on("broadcast", { event: "attention" }, ({ payload }) => {
        const alert = payload as AttentionPayload;
        const isForMe = alert.targetUserId === me.id || alert.targetUserId === null;
        if (
          !inCallRef.current ||
          !isForMe ||
          typeof alert.id !== "string" ||
          typeof alert.fromName !== "string" ||
          typeof alert.fromUserId !== "string" ||
          alert.fromUserId === me.id ||
          Date.now() - lastAttentionReceivedRef.current < 2000
        ) {
          return;
        }

        lastAttentionReceivedRef.current = Date.now();
        setAttentionAlert({ id: alert.id, fromName: alert.fromName });
        void playAttentionSound().catch(() => undefined);
        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
        attentionTimeoutRef.current = setTimeout(() => setAttentionAlert(null), 4000);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            user_id: me.id,
            name: me.name,
            avatar: me.avatar,
            peer_id: null,
            cam_on: false,
            mic_on: false,
            raised_hand: false,
          });
        }
      });

    return () => {
      channelRef.current = null;
      if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [roomId, me?.id, me?.name, me?.avatar, accessGranted]);

  // keep presence payload in sync with call state
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !me) return;
    void channel.track({
      user_id: me.id,
      name: me.name,
      avatar: me.avatar,
      peer_id: inCall ? peerId : null,
      cam_on: inCall ? camOn || sharingScreen : false,
      mic_on: inCall ? micLive : false,
      raised_hand: inCall ? raisedHand : false,
    });
  }, [inCall, peerId, camOn, micLive, raisedHand, sharingScreen, me?.id, me?.name, me?.avatar]);

  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  /* ---------- media track state ---------- */
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (!sharingScreen) stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    stream.getAudioTracks().forEach((t) => (t.enabled = micLive));
  }, [camOn, micLive, localStream, sharingScreen]);

  /* ---------- push to talk key ---------- */
  useEffect(() => {
    if (!pushToTalk || !inCall) return;
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable === true
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== pttKey || isTyping(e.target)) return;
      e.preventDefault();
      setPttActive(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== pttKey) return;
      setPttActive(false);
    };
    const blur = () => setPttActive(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [pushToTalk, pttKey, inCall]);

  const attachCall = useCallback((call: MediaConnection) => {
    callsRef.current.set(call.peer, call);
    call.on("stream", (stream) => {
      setRemotes((prev) => {
        const next = prev.filter((r) => r.peerId !== call.peer);
        return [...next, { peerId: call.peer, stream }];
      });
    });
    const drop = () => {
      callsRef.current.delete(call.peer);
      setRemotes((prev) => prev.filter((r) => r.peerId !== call.peer));
      if (inCallRef.current && navigator.onLine) {
        setConnectionStatus("reconnecting");
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => setReconnectTick((value) => value + 1), 1500);
      }
    };
    call.on("close", drop);
    call.on("error", drop);
  }, []);

  /* ---------- P2P mesh: call every peer present in the room ---------- */
  useEffect(() => {
    const peer = peerRef.current;
    const stream = streamRef.current;
    if (!peer || !stream || !peerId || !inCall) return;
    for (const member of members) {
      const target = member.peer_id;
      if (!target || target === peerId) continue;
      if (callsRef.current.has(target)) continue;
      // deterministic caller: the lower peer id initiates
      if (peerId > target) continue;
      try {
        attachCall(peer.call(target, stream));
      } catch {
        /* peer may have just left */
      }
    }
  }, [members, peerId, inCall, attachCall, localStream, reconnectTick]);

  useEffect(() => {
    if (!inCall) return;
    const offline = () => setConnectionStatus("reconnecting");
    const online = () => {
      setConnectionStatus("reconnecting");
      const peer = peerRef.current;
      if (peer?.disconnected) {
        try { peer.reconnect(); } catch {}
      }
      setReconnectTick((value) => value + 1);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [inCall]);

  useEffect(() => {
    if (!inCall) return;
    const checkQuality = async () => {
      if (!navigator.onLine) {
        setConnectionStatus("reconnecting");
        return;
      }
      let lost = 0;
      let received = 0;
      let slow = false;
      for (const call of callsRef.current.values()) {
        const connection = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
        if (!connection) continue;
        if (connection.connectionState === "failed" || connection.connectionState === "disconnected") {
          setConnectionStatus("reconnecting");
          call.close();
          setReconnectTick((value) => value + 1);
          return;
        }
        const stats = await connection.getStats();
        stats.forEach((report) => {
          if (report.type === "inbound-rtp") {
            lost += Number(report.packetsLost ?? 0);
            received += Number(report.packetsReceived ?? 0);
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            slow ||= Number(report.currentRoundTripTime ?? 0) > 0.45;
          }
        });
      }
      const lossRate = lost + received > 0 ? lost / (lost + received) : 0;
      setConnectionStatus(lossRate > 0.08 || slow ? "unstable" : "connected");
    };
    void checkQuality();
    const interval = setInterval(() => void checkQuality(), 5000);
    return () => clearInterval(interval);
  }, [inCall, reconnectTick]);

  /* ---------- Obter Stream com Fallback para Tablet/Mobile ---------- */
  const acquireUserMedia = useCallback(
    async (preferredVideoId?: string, preferredAudioId?: string) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador não suporta chamadas de vídeo e áudio.");
      }

      const audioConstraint: boolean | MediaTrackConstraints = preferredAudioId
        ? { deviceId: { exact: preferredAudioId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };

      // Tentativa 1: Resolução ideal em HD (para Notebooks e Tablets modernos)
      try {
        const videoConstraint: boolean | MediaTrackConstraints = preferredVideoId
          ? { deviceId: { exact: preferredVideoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };

        return await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: audioConstraint,
        });
      } catch (err1) {
        console.warn("Tentativa HD falhou no tablet, tentando constraints flexíveis:", err1);
      }

      // Tentativa 2: Sem restrição de resolução (compatibilidade total com tablets Android/iPad)
      try {
        const fallbackVideo: boolean | MediaTrackConstraints = preferredVideoId
          ? { deviceId: { exact: preferredVideoId } }
          : true;

        return await navigator.mediaDevices.getUserMedia({
          video: fallbackVideo,
          audio: audioConstraint,
        });
      } catch (err2) {
        console.warn("Tentativa flexível falhou, tentando fallback de áudio apenas:", err2);
      }

      // Tentativa 3: Apenas áudio caso a câmera esteja bloqueada ou sem permissão
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioConstraint,
        });
        setCamOn(false);
        return audioOnlyStream;
      } catch (err3) {
        throw new Error(
          "Permissão de microfone ou câmera negada. Por favor, autorize o acesso no seu navegador."
        );
      }
    },
    []
  );

  /* ---------- Alternar Câmera no Tablet (Frontal ↔ Traseira) ---------- */
  const switchCamera = useCallback(async () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedVideoDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    if (!nextDevice) return;

    setSelectedVideoDeviceId(nextDevice.deviceId);

    if (inCall && streamRef.current) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextDevice.deviceId } },
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          const oldVideoTrack = streamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            streamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          streamRef.current.addTrack(newVideoTrack);
          cameraTrackRef.current = newVideoTrack;
          setLocalStream(new MediaStream(streamRef.current.getTracks()));

          // Substitui o track em todas as conexões PeerJS ativas
          callsRef.current.forEach((call) => {
            const peerConnection = (call as unknown as { peerConnection?: RTCPeerConnection })?.peerConnection;
            if (peerConnection) {
              const senders = peerConnection.getSenders();
              const videoSender = senders.find((s) => s.track?.kind === "video");
              if (videoSender) {
                void videoSender.replaceTrack(newVideoTrack);
              }
            }
          });
        }
      } catch (e) {
        console.error("Falha ao alternar câmera no tablet:", e);
      }
    }
  }, [videoDevices, selectedVideoDeviceId, inCall]);

  const replaceOutgoingVideo = useCallback((track: MediaStreamTrack | null) => {
    callsRef.current.forEach((call) => {
      const connection = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
      const sender = connection?.getSenders().find((item) => item.track?.kind === "video");
      if (sender) void sender.replaceTrack(track);
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    const stream = streamRef.current;
    const cameraTrack = cameraTrackRef.current;
    if (!stream) return;
    const screenTrack = stream.getVideoTracks()[0];
    if (screenTrack && screenTrack !== cameraTrack) {
      stream.removeTrack(screenTrack);
      screenTrack.stop();
    }
    if (cameraTrack) {
      cameraTrack.enabled = camOn;
      stream.addTrack(cameraTrack);
      replaceOutgoingVideo(cameraTrack);
    }
    setLocalStream(new MediaStream(stream.getTracks()));
    setSharingScreen(false);
  }, [camOn, replaceOutgoingVideo]);

  const toggleScreenShare = useCallback(async () => {
    if (sharingScreen) {
      stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia || !streamRef.current) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      const stream = streamRef.current;
      const currentVideo = stream.getVideoTracks()[0];
      if (currentVideo) stream.removeTrack(currentVideo);
      stream.addTrack(screenTrack);
      replaceOutgoingVideo(screenTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
      setSharingScreen(true);
      screenTrack.addEventListener("ended", stopScreenShare, { once: true });
    } catch {
      // The browser closes its chooser when the user cancels; no error message is needed.
    }
  }, [sharingScreen, stopScreenShare, replaceOutgoingVideo]);

  const join = useCallback(async () => {
    if (inCall || connecting) return;
    const othersInCall = members.filter((m) => m.peer_id && m.user_id !== me?.id).length;
    if (othersInCall >= MAX_PARTICIPANTS - 1) {
      setError(`A chamada está cheia (máximo de ${MAX_PARTICIPANTS} pessoas).`);
      return;
    }
    setConnecting(true);
    setConnectionStatus("connecting");
    setError(null);
    try {
      await unlockAttentionSound().catch(() => undefined);
      const stream = await acquireUserMedia(selectedVideoDeviceId, selectedAudioDeviceId);
      streamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
      stream.getVideoTracks().forEach((track) => (track.enabled = camOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn && !pushToTalk));

      // Atualiza a lista de dispositivos agora que as permissões foram concedidas
      void refreshDevices();

      const { default: PeerCtor } = await import("peerjs");
      const peer = new PeerCtor({ config: ICE });
      peerRef.current = peer;

      peer.on("call", (call) => {
        const current = streamRef.current;
        if (!current) return;
        call.answer(current);
        attachCall(call);
      });
      peer.on("error", (err) => {
        const type = (err as { type?: string }).type;
        if (inCallRef.current && (type === "network" || type === "server-error" || type === "disconnected" || type === "socket-error" || type === "socket-closed")) {
          setConnectionStatus("reconnecting");
          return;
        }
        setError(err.message);
      });
      peer.on("disconnected", () => {
        if (!inCallRef.current) return;
        setConnectionStatus("reconnecting");
        if (navigator.onLine) {
          try { peer.reconnect(); } catch {}
        }
      });

      await new Promise<void>((resolve, reject) => {
        peer.on("open", () => resolve());
        peer.on("error", reject);
        setTimeout(() => reject(new Error("Tempo esgotado ao conectar")), 15000);
      });

      setPeerId(peer.id);
      setInCall(true);
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLocalStream(null);
      peerRef.current?.destroy();
      peerRef.current = null;
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível acessar a câmera e o microfone do dispositivo.",
      );
    } finally {
      setConnecting(false);
    }
  }, [inCall, connecting, micOn, pushToTalk, attachCall, acquireUserMedia, selectedVideoDeviceId, selectedAudioDeviceId, refreshDevices, members, me?.id]);

  const sendAttention = useCallback(async (targetUserId?: string) => {
    const channel = channelRef.current;
    if (!channel || !me || !inCallRef.current || attentionCooldown) return false;

    const response = await channel.send({
      type: "broadcast",
      event: "attention",
      payload: {
        id: crypto.randomUUID(),
        fromUserId: me.id,
        fromName: me.name,
        targetUserId: targetUserId ?? null,
      },
    });

    if (response !== "ok") return false;
    setAttentionCooldown(true);
    if (attentionCooldownRef.current) clearTimeout(attentionCooldownRef.current);
    attentionCooldownRef.current = setTimeout(() => setAttentionCooldown(false), 5000);
    return true;
  }, [attentionCooldown, me]);

  const leave = useCallback(() => {
    callsRef.current.forEach((c) => c.close());
    callsRef.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemotes([]);
    setPeerId(null);
    setInCall(false);
    setRaisedHand(false);
    setSharingScreen(false);
    setConnectionStatus("connecting");
    setPttActive(false);
  }, []);

  useEffect(() => leave, [leave]);

  useEffect(() => () => {
    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
    if (attentionCooldownRef.current) clearTimeout(attentionCooldownRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
  }, []);

  const memberByPeer = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => {
      if (m.peer_id) map.set(m.peer_id, m);
    });
    return map;
  }, [members]);

  return {
    members,
    memberByPeer,
    inCall,
    connecting,
    error,
    localStream,
    remotes,
    camOn,
    setCamOn,
    micOn,
    setMicOn,
    micLive,
    deafened,
    setDeafened,
    pushToTalk,
    setPushToTalk,
    pttKey,
    setPttKey,
    pttActive,
    attentionAlert,
    attentionCooldown,
    sendAttention,
    connectionStatus,
    raisedHand,
    setRaisedHand,
    sharingScreen,
    toggleScreenShare,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    setSelectedVideoDeviceId,
    selectedAudioDeviceId,
    setSelectedAudioDeviceId,
    switchCamera,
    join,
    leave,
  };
}
