import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  Camera,
  CameraOff,
  Headphones,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  MessageSquare,
  Users,
  Volume2,
  VolumeX,
  Keyboard,
  SlidersHorizontal,
  Info,
  Loader2,
  AlertCircle
} from "lucide-react";
import { RoomSidebar, useRooms } from "@/components/RoomSidebar";
import { VideoTile } from "@/components/VideoTile";
import { ChatPanel } from "@/components/ChatPanel";
import { MembersList } from "@/components/MembersList";
import { useRoomSession } from "@/hooks/useRoomSession";
import { useSessionProfile } from "@/hooks/useSessionProfile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/room/")({
  component: RoomView,
});

function RoomView() {
  const params = useParams({ from: "/_authenticated/room/" });
  const roomId = params.roomId;
  const { profile } = useSessionProfile();
  const roomsQuery = useRooms();

  const currentRoom = roomsQuery.data?.find((r) => r.id === roomId);

  const [activeTab, setActiveTab] = useState<"chat" | "members">("chat");
  const [showSidePanel, setShowSidePanel] = useState(true);

  const session = useRoomSession(roomId, profile);

  const {
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
    join,
    leave,
  } = session;

  const totalParticipants = (inCall ? 1 : 0) + remotes.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Barra Lateral Esquerda: Salas e Usuário */}
      <RoomSidebar activeRoomId={roomId} profile={profile} />

      {/* Área Central: Chamada de Vídeo e Header */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header da Sala */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/50 px-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Radio className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">
                {currentRoom?.name ?? "Carregando sala..."}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {currentRoom?.description || "Sala de comunicação em equipe com WebRTC HD"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inCall && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                HD P2P Conectado ({totalParticipants})
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 text-xs", activeTab === "chat" && showSidePanel && "bg-accent text-accent-foreground")}
              onClick={() => {
                if (showSidePanel && activeTab === "chat") {
                  setShowSidePanel(false);
                } else {
                  setActiveTab("chat");
                  setShowSidePanel(true);
                }
              }}
            >
              <MessageSquare className="size-4" />
              <span className="hidden md:inline">Chat</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 text-xs", activeTab === "members" && showSidePanel && "bg-accent text-accent-foreground")}
              onClick={() => {
                if (showSidePanel && activeTab === "members") {
                  setShowSidePanel(false);
                } else {
                  setActiveTab("members");
                  setShowSidePanel(true);
                }
              }}
            >
              <Users className="size-4" />
              <span className="hidden md:inline">Membros ({members.length})</span>
            </Button>
          </div>
        </header>

        {/* Palco Principal de Vídeo */}
        <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden p-4 bg-background">
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!inCall ? (
            /* Tela Pré-Chamada */
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/30 p-8 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-border bg-surface text-primary shadow-panel">
                <PhoneCall className="size-10" />
              </div>
              <h2 className="mt-6 text-xl font-bold tracking-tight">
                Pronto para entrar na chamada de vídeo?
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Conecte-se com áudio e vídeo HD ponto a ponto (WebRTC via PeerJS).
                Controle individual de volume, aperte-para-falar e compartilhamento sem servidor intermediário.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  disabled={connecting}
                  onClick={() => void join()}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6 shadow-glow"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Iniciando câmera e P2P...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="size-5" />
                      Entrar na chamada
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Camera className="size-4 text-primary" /> HD 720p / 30fps
                </div>
                <div className="flex items-center gap-1.5">
                  <Headphones className="size-4 text-primary" /> Áudio com cancelamento de eco
                </div>
              </div>
            </div>
          ) : (
            /* Grade Responsiva de Vídeos */
            <div className="flex flex-1 flex-col min-h-0">
              <div
                className={cn(
                  "grid flex-1 gap-3 overflow-y-auto p-1 items-center justify-center",
                  totalParticipants === 1 && "grid-cols-1 max-w-4xl mx-auto w-full",
                  totalParticipants === 2 && "grid-cols-1 md:grid-cols-2",
                  totalParticipants >= 3 && totalParticipants <= 4 && "grid-cols-1 sm:grid-cols-2",
                  totalParticipants >= 5 && "grid-cols-2 lg:grid-cols-3"
                )}
              >
                {/* Meu Vídeo Local */}
                <VideoTile
                  stream={localStream}
                  name={profile?.name ?? "Você"}
                  isLocal
                  camOn={camOn}
                  micOn={micLive}
                  deafened={deafened}
                />

                {/* Vídeos Remotos */}
                {remotes.map((remote) => {
                  const member = memberByPeer.get(remote.peerId);
                  return (
                    <VideoTile
                      key={remote.peerId}
                      stream={remote.stream}
                      name={member?.name ?? Participante ()}
                      camOn={member?.cam_on ?? true}
                      micOn={member?.mic_on ?? true}
                      deafened={deafened}
                    />
                  );
                })}
              </div>

              {/* Status Push-to-Talk Ativo */}
              {pushToTalk && (
                <div className="py-2 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold tracking-wide transition-colors",
                      pttActive
                        ? "bg-primary text-primary-foreground shadow-glow animate-pulse"
                        : "bg-surface border border-border text-muted-foreground"
                    )}
                  >
                    <Keyboard className="size-3.5" />
                    {pttActive
                      ? "TRANSMITINDO VOZ (Segurando Espaço)"
                      : "APERTE-PARA-FALAR ATIVO (Segure Espaço para falar)"}
                  </span>
                </div>
              )}

              {/* Barra Flutuante de Controles de Mídia */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface/90 p-3 shadow-panel backdrop-blur sm:gap-4">
                {/* Microfone */}
                <Button
                  variant={micOn ? "secondary" : "destructive"}
                  size="icon"
                  className="size-11 rounded-xl shadow"
                  onClick={() => setMicOn((v) => !v)}
                  aria-label={micOn ? "Mutar microfone" : "Ativar microfone"}
                  title={micOn ? "Mutar microfone" : "Ativar microfone"}
                >
                  {micOn ? <Mic className="size-5 text-primary" /> : <MicOff className="size-5" />}
                </Button>

                {/* Câmera */}
                <Button
                  variant={camOn ? "secondary" : "destructive"}
                  size="icon"
                  className="size-11 rounded-xl shadow"
                  onClick={() => setCamOn((v) => !v)}
                  aria-label={camOn ? "Desligar câmera" : "Ligar câmera"}
                  title={camOn ? "Desligar câmera" : "Ligar câmera"}
                >
                  {camOn ? <Camera className="size-5 text-primary" /> : <CameraOff className="size-5" />}
                </Button>

                {/* Silenciar Áudio do PC (Deafen) */}
                <Button
                  variant={deafened ? "destructive" : "secondary"}
                  size="icon"
                  className="size-11 rounded-xl shadow"
                  onClick={() => setDeafened((v) => !v)}
                  aria-label={deafened ? "Desmutar som do computador" : "Silenciar saída de som"}
                  title={deafened ? "Desmutar som do computador" : "Silenciar saída de som (Deafen)"}
                >
                  {deafened ? <VolumeX className="size-5" /> : <Volume2 className="size-5 text-primary" />}
                </Button>

                <div className="h-6 w-px bg-border mx-1" />

                {/* Toggle Push-to-Talk */}
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-background/60 border border-border/50">
                  <Switch
                    id="ptt-mode"
                    checked={pushToTalk}
                    onCheckedChange={setPushToTalk}
                  />
                  <Label htmlFor="ptt-mode" className="text-xs cursor-pointer select-none font-medium">
                    Push-to-Talk
                  </Label>
                </div>

                {/* Encerrar Chamada */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 rounded-xl px-4 ml-auto"
                  onClick={() => leave()}
                >
                  <PhoneOff className="size-4" />
                  <span className="hidden sm:inline">Desconectar</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel Lateral Direito: Chat e Membros Online */}
      {showSidePanel && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-sidebar overflow-hidden transition-all">
          <div className="flex border-b border-border bg-surface/30">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                activeTab === "chat"
                  ? "border-primary text-foreground bg-accent/20"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Chat em Texto
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                activeTab === "members"
                  ? "border-primary text-foreground bg-accent/20"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Membros ({members.length})
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" && profile && (
              <ChatPanel roomId={roomId} userId={profile.id} />
            )}
            {activeTab === "members" && (
              <div className="p-4 overflow-y-auto h-full">
                <MembersList members={members} />
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
