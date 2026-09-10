import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Peer from "peerjs";
import type { MediaConnection } from "peerjs";
import { supabase } from "@/integrations/supabase/client";

export type Member = {
  user_id: string;
  name: string;
  avatar: string | null;
  peer_id: string | null;
  cam_on: boolean;
  mic_on: boolean;
};

export type RemoteParticipant = {
  peerId: string;
  stream: MediaStream;
};

export type MediaDeviceInfoItem = {
  deviceId: string;
  label: string;
};

type Me = { id: string; name: string; avatar: string | null };

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

export function useRoomSession(roomId: string, me: Me | null) {
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
  const [pttKey, setPttKey] = useState<string>("Space");
  const [pttActive, setPttActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dispositivos identificados no navegador (Tablets, Celulares e Notebooks)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfoItem[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfoItem[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  const micLive = micOn && (!pushToTalk || pttActive);

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

      if (vDevs.length > 0 && !selectedVideoDeviceId) {
        setSelectedVideoDeviceId(vDevs[0].deviceId);
      }
      if (aDevs.length > 0 && !selectedAudioDeviceId) {
        setSelectedAudioDeviceId(aDevs[0].deviceId);
      }
    } catch (e) {
      console.warn("Não foi possível listar dispositivos de mídia:", e);
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  useEffect(() => {
    void refreshDevices();
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [refreshDevices]);

  /* ---------- presence ---------- */
  useEffect(() => {
    if (!me || !roomId) return;
    const channelName = `room-presence-${roomId}-${me.id}-${Math.random().toString(36).slice(2, 7)}`;
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            user_id: me.id,
            name: me.name,
            avatar: me.avatar,
            peer_id: null,
            cam_on: false,
            mic_on: false,
          });
        }
      });

    return () => {
      channelRef.current = null;
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [roomId, me?.id, me?.name, me?.avatar]);

  // keep presence payload in sync with call state
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !me) return;
    void channel.track({
      user_id: me.id,
      name: me.name,
      avatar: me.avatar,
      peer_id: inCall ? peerId : null,
      cam_on: inCall ? camOn : false,
      mic_on: inCall ? micLive : false,
    });
  }, [inCall, peerId, camOn, micLive, me?.id, me?.name, me?.avatar]);

  /* ---------- media track state ---------- */
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    stream.getAudioTracks().forEach((t) => (t.enabled = micLive));
  }, [camOn, micLive, localStream]);

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
      if (e.code === "Space") e.preventDefault();
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
  }, [members, peerId, inCall, attachCall, localStream]);

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

  const join = useCallback(async () => {
    if (inCall || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const stream = await acquireUserMedia(selectedVideoDeviceId, selectedAudioDeviceId);
      streamRef.current = stream;
      setLocalStream(stream);
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
      peer.on("error", (err) => setError(err.message));

      await new Promise<void>((resolve, reject) => {
        peer.on("open", () => resolve());
        peer.on("error", reject);
        setTimeout(() => reject(new Error("Tempo esgotado ao conectar")), 15000);
      });

      setPeerId(peer.id);
      setInCall(true);
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
  }, [inCall, connecting, micOn, pushToTalk, attachCall, acquireUserMedia, selectedVideoDeviceId, selectedAudioDeviceId, refreshDevices]);

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
    setPttActive(false);
  }, []);

  useEffect(() => leave, [leave]);

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
