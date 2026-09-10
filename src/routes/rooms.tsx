import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Hash, Plus, Radio, Menu, X } from "lucide-react";
import { RoomSidebar, useRooms } from "@/components/RoomSidebar";
import { useSessionProfile } from "@/hooks/useSessionProfile";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rooms")({
  ssr: false,
  component: RoomsPage,
});

function RoomsPage() {
  const navigate = useNavigate();
  const { profile, loading } = useSessionProfile();
  const rooms = useRooms();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-3">
          <Radio className="size-6 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando salas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar para desktop */}
      <div className="hidden md:block h-full shrink-0">
        <RoomSidebar profile={profile} />
      </div>

      {/* Drawer móvel para tablets e celulares */}
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
              <RoomSidebar profile={profile} />
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 text-center relative overflow-y-auto">
        {/* Botão de menu no topo para mobile */}
        <div className="absolute top-4 left-4 md:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs bg-surface"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-4" />
            <span>Salas & Membros</span>
          </Button>
        </div>

        <div className="max-w-md space-y-6 w-full mt-10 md:mt-0">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-panel">
            <Radio className="size-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {loading ? "Carregando..." : `Olá, ${profile?.name || "Membro"}!`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Escolha uma sala abaixo ou crie uma nova para começar a chamada em equipe com vídeo HD e chat em tempo real.
            </p>
          </div>

          {rooms.data && rooms.data.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Salas ativas
              </p>
              <div className="grid gap-2">
                {rooms.data.map((room) => (
                  <Button
                    key={room.id}
                    asChild
                    variant="outline"
                    className="w-full justify-start gap-3 h-12 text-sm border-border bg-surface/60 hover:bg-surface hover:text-primary transition-all"
                  >
                    <Link to="/room/$roomId" params={{ roomId: room.id }}>
                      <Hash className="size-4 text-primary shrink-0" />
                      <span className="truncate">{room.name}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="rounded-xl border border-dashed border-border p-6 bg-surface/20">
                <p className="text-xs text-muted-foreground">
                  Nenhuma sala foi criada ainda. Use o menu lateral para criar a primeira sala!
                </p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
