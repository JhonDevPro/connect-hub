import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Radio, Menu, X, Settings } from "lucide-react";
import { RoomSidebar, useRooms } from "@/components/RoomSidebar";
import { useSessionProfile } from "@/hooks/useSessionProfile";
import { Button } from "@/components/ui/button";
import { AccessDiagram } from "@/components/AccessDiagram";
import { AdminPanel } from "@/components/AdminPanel";
import { useIsAdmin, useRoomAccessList } from "@/hooks/useAccess";

export const Route = createFileRoute("/rooms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mapa de acesso — Nexo Hub" },
      { name: "description", content: "Mapa de salas protegidas para videochamadas P2P da equipe." },
      { property: "og:title", content: "Mapa de acesso — Nexo Hub" },
      { property: "og:description", content: "Acesse as salas protegidas de comunicação da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const { profile, loading } = useSessionProfile();
  const rooms = useRooms();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const admin = useIsAdmin(profile?.id);
  const access = useRoomAccessList(profile?.id);

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
        <RoomSidebar profile={profile} isAdmin={admin.data} onOpenAdmin={() => setAdminOpen(true)} />
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
              <RoomSidebar profile={profile} isAdmin={admin.data} onOpenAdmin={() => setAdminOpen(true)} />
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col relative min-w-0 overflow-hidden">
        {/* Botão de menu no topo para mobile */}
        <div className="absolute top-4 left-4 md:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs bg-surface"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-4" />
            <span>Salas e membros</span>
          </Button>
        </div>
        {admin.data && (
          <Button variant="outline" size="sm" className="absolute right-4 top-4 z-10 gap-2" onClick={() => setAdminOpen(true)}>
            <Settings className="size-4" /> Administração
          </Button>
        )}
        <AccessDiagram rooms={rooms.data ?? []} access={access.data ?? new Set()} isAdmin={!!admin.data} />
      </main>
      {profile && admin.data && <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} userId={profile.id} />}
    </div>
  );
}
