import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
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
  Loader2,
  AlertCircle,
  SwitchCamera,
  Menu,
  X,
  Settings2
} from "lucide-react";
import { RoomSidebar, useRooms } from "@/components/RoomSidebar";
import { VideoTile } from "@/components/VideoTile";
import { ChatPanel } from "@/components/ChatPanel";
import { MembersList } from "@/components/MembersList";
import { useRoomSession, MAX_PARTICIPANTS } from "@/hooks/useRoomSession";
import { useSessionProfile } from "@/hooks/useSessionProfile";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/room/$roomId")({
  ssr: false,
  component: RoomView,
});

function RoomView() {
  const params = useParams({ from: "/room/$roomId" });
  const roomId = params.roomId;
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useSessionProfile();
  const roomsQuery = useRooms();

  const [activeTab, setActiveTab] = useState<"chat" | "members">("chat");
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define side panel aberto por padrão apenas em telas grandes (desktops)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setShowSidePanel(true);
    }
  }, []);

  const currentRoom = roomsQuery.data?.find((r) => r.id === roomId);

  // Sessão da chamada de vídeo P2P com identificação de hardware do tablet
  const session = useRoomSession(roomId, profile);

  // Presença global de membros do time (verde = online, vermelho = offline)
  const { members: allTeamMembers } = useGlobalPresence(profile);

  if (profileLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-panel">
            <Radio className="size-6 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-foreground">Entrando na sala...</p>
          <p className="text-xs text-muted-foreground">Sincronizando áudio e vídeo da equipe</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground font-sans p-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Radio className="size-7" />
          </div>
          <h2 className="text-xl font-bold">Faça login para entrar na sala</h2>
          <p className="text-xs text-muted-foreground">
            Você precisa estar logado com sua conta Google ou e-mail para participar da chamada e do chat.
          </p>
          <Button asChild className="w-full">
            <Link to="/auth">Fazer login / Criar conta</Link>
          </Button>
        </div>
      </div>
    );
  }

  const {
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
  } = session;

  const totalParticipants = (inCall ? 1 : 0) + remotes.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Barra Lateral Esquerda para Desktop */}
      <div className="hidden md:block h-full shrink-0">
        <RoomSidebar activeRoomId={roomId} profile={profile} />
      </div>

      {/* Drawer Móvel da Barra Lateral para Tablets e Celulares */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 flex-col bg-sidebar shadow-2xl z-10">
            <div className="flex justify-end p-2 border-b border-border/40">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <RoomSidebar activeRoomId={roomId} profile={profile} />
            </div>
          </div>
        </div>
      )}

      {/* Área Central Principal */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header Superior da Sala */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/50 px-3 md:px-4 backdrop-blur">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Botão de Menu para Tablet/Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu de salas"
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Radio className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate text-foreground">
                {currentRoom?.name ?? "Carregando sala..."}
              </h1>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">
                {currentRoom?.description || "Sala de comunicação em equipe com WebRTC HD"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {inCall && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                HD P2P ({totalParticipants})
              </span>
            )}

            {/* Alternar Câmera no Tablet */}
            {videoDevices.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-primary hover:bg-primary/10"
                onClick={() => void switchCamera()}
                title="Alternar Câmera do Tablet (Frontal / Traseira)"
                aria-label="Alternar Câmera"
              >
                <SwitchCamera className="size-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 text-xs px-2.5", activeTab === "chat" && showSidePanel && "bg-accent text-accent-foreground")}
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
              className={cn("gap-1.5 text-xs px-2.5", activeTab === "members" && showSidePanel && "bg-accent text-accent-foreground")}
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
              <span className="hidden md:inline">
                Membros ({allTeamMembers.filter((m) => m.isOnline).length} on)
              </span>
            </Button>
          </div>
        </header>

        {/* Palco de Vídeo */}
        <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden p-2 sm:p-4 bg-background">
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!inCall ? (
            /* Tela Pré-Chamada com Identificação de Câmeras do Tablet */
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/30 p-4 sm:p-8 text-center overflow-y-auto">
              <div className="mx-auto flex size-16 sm:size-20 items-center justify-center rounded-3xl border border-border bg-surface text-primary shadow-panel">
                <PhoneCall className="size-8 sm:size-10" />
              </div>
              <h2 className="mt-4 sm:mt-6 text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Entrar na chamada de vídeo
              </h2>
              <p className="mt-2 max-w-md text-xs sm:text-sm text-muted-foreground">
                Compatível com Tablets, Celulares e Notebooks. Suporte a câmeras frontal e traseira,
                cancelamento de eco e transmissão direta P2P.
              </p>

              {/* Seletor de Câmeras e Microfones do Dispositivo */}
              <div className="mt-4 w-full max-w-sm rounded-xl border border-border/70 bg-surface/60 p-3 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Settings2 className="size-3.5 text-primary" /> Dispositivos Detectados
                  </span>
                  {videoDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void switchCamera()}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <SwitchCamera className="size-3" /> Alternar câmera
                    </button>
                  )}
                </div>

                {/* Seletor de Câmera */}
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Câmera ({videoDevices.length} identificada{videoDevices.length === 1 ? "" : "s"}):
                  </label>
                  <select
                    value={selectedVideoDeviceId}
                    onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">Câmera padrão do sistema</option>
                    ) : (
                      videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Seletor de Microfone */}
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Microfone ({audioDevices.length} identificado{audioDevices.length === 1 ? "" : "s"}):
                  </label>
                  <select
                    value={selectedAudioDeviceId}
                    onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {audioDevices.length === 0 ? (
                      <option value="">Microfone padrão do sistema</option>
                    ) : (
                      audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  disabled={connecting}
                  onClick={() => void join()}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6 shadow-glow text-sm sm:text-base"
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

              <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Camera className="size-4 text-primary" /> HD Adaptável
                </div>
                <div className="flex items-center gap-1.5">
                  <Headphones className="size-4 text-primary" /> Áudio cancelamento de eco
                </div>
              </div>
            </div>
          ) : (
            /* Grade Responsiva de Vídeos para Tablets e Notebooks */
            <div className="flex flex-1 flex-col min-h-0">
              <div className="px-1 pb-1 text-right text-[11px] text-muted-foreground">
                {totalParticipants} / {MAX_PARTICIPANTS} na chamada
              </div>
              <div
                className={cn(
                  "grid flex-1 gap-2 sm:gap-3 overflow-y-auto p-1 content-center",
                  totalParticipants === 1 && "grid-cols-1 max-w-4xl mx-auto w-full",
                  totalParticipants === 2 && "grid-cols-1 sm:grid-cols-2",
                  totalParticipants >= 3 && totalParticipants <= 4 && "grid-cols-2",
                  totalParticipants >= 5 && totalParticipants <= 6 && "grid-cols-2 lg:grid-cols-3",
                  totalParticipants >= 7 && totalParticipants <= 9 && "grid-cols-2 md:grid-cols-3",
                  totalParticipants >= 10 && "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                )}
              >
                {/* Meu Vídeo Local */}
                <VideoTile
                  stream={localStream}
                  name={profile?.name ? `${profile.name} (Você)` : "Você"}
                  isLocal
                  camOn={camOn}
                  micOn={micLive}
                  deafened={deafened}
                />

                {/* Vídeos Remotos com Slider de Volume Individual */}
                {remotes.map((remote) => {
                  const m = session.memberByPeer.get(remote.peerId);
                  return (
                    <VideoTile
                      key={remote.peerId}
                      stream={remote.stream}
                      name={m?.name || `Participante (${remote.peerId.slice(0, 4)})`}
                      camOn={m?.cam_on ?? true}
                      micOn={m?.mic_on ?? true}
                      deafened={deafened}
                    />
                  );
                })}
              </div>

              {/* Status Push-to-Talk */}
              {pushToTalk && (
                <div className="py-1.5 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] sm:text-xs font-semibold tracking-wide transition-colors",
                      pttActive
                        ? "bg-primary text-primary-foreground shadow-glow animate-pulse"
                        : "bg-surface border border-border text-muted-foreground"
                    )}
                  >
                    <Keyboard className="size-3.5" />
                    {pttActive
                      ? "TRANSMITINDO VOZ (Barra de Espaço Pressionada)"
                      : "PUSH-TO-TALK ATIVO: Segure a Barra de Espaço para Falar"}
                  </span>
                </div>
              )}

              {/* Barra Flutuante de Controles de Mídia */}
              <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface/90 p-2 sm:p-3 shadow-panel backdrop-blur sm:gap-4">
                {/* Microfone */}
                <Button
                  variant={micOn ? "secondary" : "destructive"}
                  size="icon"
                  className="size-10 sm:size-11 rounded-xl shadow"
                  onClick={() => setMicOn((v) => !v)}
                  aria-label={micOn ? "Mutar microfone" : "Ativar microfone"}
                  title={micOn ? "Mutar microfone" : "Ativar microfone"}
                >
                  {micOn ? <Mic className="size-4 sm:size-5 text-primary" /> : <MicOff className="size-4 sm:size-5" />}
                </Button>

                {/* Câmera */}
                <Button
                  variant={camOn ? "secondary" : "destructive"}
                  size="icon"
                  className="size-10 sm:size-11 rounded-xl shadow"
                  onClick={() => setCamOn((v) => !v)}
                  aria-label={camOn ? "Desligar câmera" : "Ligar câmera"}
                  title={camOn ? "Desligar câmera" : "Ligar câmera"}
                >
                  {camOn ? <Camera className="size-4 sm:size-5 text-primary" /> : <CameraOff className="size-4 sm:size-5" />}
                </Button>

                {/* Alternar Câmera Frontal / Traseira (Tablet) */}
                {videoDevices.length > 1 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-10 sm:size-11 rounded-xl shadow text-primary"
                    onClick={() => void switchCamera()}
                    aria-label="Virar câmera do tablet"
                    title="Alternar Câmera (Frontal / Traseira)"
                  >
                    <SwitchCamera className="size-4 sm:size-5" />
                  </Button>
                )}

                {/* Silenciar Áudio do PC/Tablet (Deafen) */}
                <Button
                  variant={deafened ? "destructive" : "secondary"}
                  size="icon"
                  className="size-10 sm:size-11 rounded-xl shadow"
                  onClick={() => setDeafened((v) => !v)}
                  aria-label={deafened ? "Desmutar som" : "Silenciar saída de som"}
                  title={deafened ? "Desmutar som" : "Silenciar saída de som (Deafen)"}
                >
                  {deafened ? <VolumeX className="size-4 sm:size-5" /> : <Volume2 className="size-4 sm:size-5 text-primary" />}
                </Button>

                <div className="h-6 w-px bg-border mx-0.5 sm:mx-1 hidden sm:block" />

                {/* Switch Push-to-Talk (escondido em telas muito estreitas) */}
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-xl bg-background/60 border border-border/50">
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
                  className="gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 ml-auto text-xs sm:text-sm"
                  onClick={() => leave()}
                >
                  <PhoneOff className="size-4" />
                  <span>Sair</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel Lateral Direito: Chat e Membros */}
      {showSidePanel && (
        <aside className="fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] flex flex-col border-l border-border bg-sidebar shadow-2xl md:relative md:shadow-none md:z-auto transition-all">
          <div className="flex items-center border-b border-border bg-surface/30">
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
              Membros ({allTeamMembers.length})
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 mr-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSidePanel(false)}
              aria-label="Fechar painel"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" && profile && (
              <ChatPanel roomId={roomId} userId={profile.id} />
            )}
            {activeTab === "members" && (
              <div className="p-4 overflow-y-auto h-full">
                <MembersList members={allTeamMembers} />
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
