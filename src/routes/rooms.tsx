import { useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Hash, Plus, Video, Radio } from "lucide-react";
import { RoomSidebar, useRooms } from "@/components/RoomSidebar";
import { useSessionProfile } from "@/hooks/useSessionProfile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rooms")({
  component: RoomsPage,
});

function RoomsPage() {
  const navigate = useNavigate();
  const { profile, loading } = useSessionProfile();
  const rooms = useRooms();

  useEffect(() => {
    // Checa se o usuário está autenticado
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session && !loading) {
        void navigate({ to: "/auth", replace: true });
      }
    });
  }, [loading, navigate]);

  useEffect(() => {
    // Redireciona automaticamente para a primeira sala disponível
    if (!loading && rooms.data && rooms.data.length > 0) {
      const firstRoom = rooms.data[0];
      if (firstRoom) {
        void navigate({
          to: "/room/",
          params: { roomId: firstRoom.id },
          replace: true,
        });
      }
    }
  }, [loading, rooms.data, navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <RoomSidebar profile={profile} />

      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-panel">
            <Radio className="size-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {loading ? "Carregando perfil..." : Olá, !}
            </h1>
            <p className="text-sm text-muted-foreground">
              Escolha uma sala na barra lateral ou crie uma nova sala para começar a chamada em equipe com vídeo HD e chat em tempo real.
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
                    className="w-full justify-start gap-3 h-12 text-sm border-border bg-surface/60 hover:bg-surface hover:text-primary"
                  >
                    <Link to="/room/" params={{ roomId: room.id }}>
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
                  Nenhuma sala foi criada ainda. Use o botão "+" na barra lateral para criar a primeira sala!
                </p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
