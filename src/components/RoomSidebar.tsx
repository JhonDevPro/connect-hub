import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, LogOut, Radio, Users, Mail, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SessionProfile } from "@/hooks/useSessionProfile";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";

export type Room = { id: string; name: string; description: string | null; layer: string };

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, description, layer")
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Erro ao carregar salas:", error);
        return [];
      }
      return (data || []) as Room[];
    },
  });
}

export function RoomSidebar({
  activeRoomId,
  profile,
  isAdmin = false,
  onOpenAdmin,
}: {
  activeRoomId?: string;
  profile: SessionProfile | null;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
}) {
  const rooms = useRooms();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Presença de todos os membros do sistema com indicador online (verde) / offline (vermelho)
  const { members, onlineCount } = useGlobalPresence(profile);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar font-sans select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 text-primary border-b border-sidebar-border/40">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Radio className="size-4" />
        </div>
        <Link to="/rooms" className="font-display text-base font-bold text-foreground hover:opacity-90">
          Nexo Hub
        </Link>
      </div>

      {/* Lista de Salas */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Salas de Chamada
        </span>
        {isAdmin && onOpenAdmin && (
          <Button variant="ghost" size="icon" className="size-7" aria-label="Painel administrativo" onClick={onOpenAdmin} title="Painel administrativo">
            <Settings className="size-4" />
          </Button>
        )}
      </div>

      <nav className="space-y-0.5 overflow-y-auto px-2 max-h-48 scrollbar-thin">
        {rooms.isLoading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Carregando salas...</p>
        ) : rooms.data?.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Nenhuma sala criada. Clique em + acima.
          </p>
        ) : (
          rooms.data?.map((room) => (
            <div key={room.id} className="relative">
              <Link
                to="/room/$roomId"
                params={{ roomId: room.id }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  room.id === activeRoomId
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                <Hash className="size-4 shrink-0 opacity-70" />
                <span className="truncate">{room.name}</span>
              </Link>
            </div>
          ))
        )}
      </nav>

      {/* Divisor */}
      <div className="my-3 mx-4 border-t border-sidebar-border/40" />

      {/* Lista de Membros Online/Offline */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="size-3.5" /> Membros
        </span>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
          {onlineCount} online
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 space-y-1">
        {members.filter((m) => m.isOnline).map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs hover:bg-surface/60 transition-colors"
          >
            <div className="relative shrink-0">
              <div className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-secondary text-[10px] font-bold text-foreground">
                {member.avatar ? (
                  <img src={member.avatar} alt="" className="size-full object-cover" />
                ) : (
                  (member.name || "?").slice(0, 2).toUpperCase()
                )}
              </div>
              {/* Pontinho verde (online) ou vermelho (offline) */}
              <span
                title={member.isOnline ? "Online" : "Offline (fechou a página)"}
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar",
                  member.isOnline
                    ? "bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"
                    : "bg-red-500/80"
                )}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {member.name}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                <Mail className="size-2.5 shrink-0 opacity-60" />
                <span>{member.email || (member.isOnline ? "Conectado" : "Membro da equipe")}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé: Meu Usuário Logado e Logout */}
      <div className="border-t border-sidebar-border/60 bg-surface/40 p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-bold text-primary border border-primary/30">
              {profile?.avatar ? (
                <img src={profile.avatar} alt="" className="size-full object-cover" />
              ) : (
                (profile?.name ?? "?").slice(0, 2).toUpperCase()
              )}
            </div>
            {/* Pontinho verde do próprio usuário online */}
            <span
              title="Você está online"
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-emerald-500"
            />
          </div>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">
              {profile?.name || "Conectando..."}
            </span>
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {profile?.email || "Autenticado"}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
