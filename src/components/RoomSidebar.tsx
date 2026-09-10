import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, LogOut, Plus, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SessionProfile } from "@/hooks/useSessionProfile";

export type Room = { id: string; name: string; description: string | null };

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, description")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Room[];
    },
  });
}

export function RoomSidebar({
  activeRoomId,
  profile,
}: {
  activeRoomId?: string;
  profile: SessionProfile | null;
}) {
  const rooms = useRooms();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const createRoom = useMutation({
    mutationFn: async (name: string) => {
      if (!profile) throw new Error("Sessão expirada");
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name, created_by: profile.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setNewName("");
      setAdding(false);
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      void navigate({ to: "/room/$roomId", params: { roomId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4 text-primary">
        <Radio className="size-5" />
        <Link to="/" className="font-display text-base font-semibold text-foreground">
          Nexo
        </Link>
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Salas
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Nova sala"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {adding && (
        <form
          className="px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = newName.trim();
            if (value) createRoom.mutate(value);
          }}
        >
          <Input
            autoFocus
            value={newName}
            placeholder="Nome da sala"
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 bg-background text-sm"
          />
        </form>
      )}

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
        {rooms.data?.map((room) => (
          <Link
            key={room.id}
            to="/room/$roomId"
            params={{ roomId: room.id }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
              room.id === activeRoomId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Hash className="size-4 shrink-0" />
            <span className="truncate">{room.name}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="size-full object-cover" />
            ) : (
              (profile?.name ?? "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{profile?.name ?? "…"}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Sair"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
