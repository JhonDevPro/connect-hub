import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Video, Lock, Network, Waves, Home, MonitorSpeaker } from "lucide-react";
import type { Room } from "@/components/RoomSidebar";
import { RoomPasswordDialog } from "@/components/RoomPasswordDialog";
import { Button } from "@/components/ui/button";
import type { Layer } from "@/hooks/useAccess";
import { cn } from "@/lib/utils";
import { getRoomIcon, type RoomIconName } from "@/lib/room-icons";
import { useRoomPresenceCounts } from "@/hooks/useRoomPresenceCounts";

// Angular ranges (deg, 0 = right, clockwise) and ring radius (% of box) per layer
const LAYER_GEO: Record<Layer, { from: number; to: number; r: number; label: string; Icon: typeof Network }> = {
  project: { from: 220, to: 320, r: 30, label: "Nível 2 - Grupos de Projeto / Dados", Icon: Network },
  work: { from: 110, to: 200, r: 30, label: "Nível 2 - Grupos de Trabalho", Icon: Waves },
  external: { from: -10, to: 80, r: 45, label: "Nível 3 - Acesso Externo / Clientes", Icon: Home },
};

export function AccessDiagram({
  rooms,
  access,
  isAdmin,
}: {
  rooms: Room[];
  access: Set<string>;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<Room | null>(null);
  const visibleRoomIds = rooms.filter((room) => isAdmin || access.has(room.id)).map((room) => room.id);
  const presenceCounts = useRoomPresenceCounts(visibleRoomIds);

  function open(room: Room) {
    if (isAdmin || access.has(room.id)) {
      void navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } else setPending(room);
  }

  const nodes = (Object.keys(LAYER_GEO) as Layer[]).flatMap((layer) => {
    const g = LAYER_GEO[layer];
    const list = rooms.filter((r) => (r.layer ?? "work") === layer);
    return list.map((room, i) => {
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      const deg = g.from + (g.to - g.from) * t;
      const rad = (deg * Math.PI) / 180;
      return { room, layer, x: 50 + g.r * Math.cos(rad), y: 50 + g.r * Math.sin(rad) };
    });
  });

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg sm:text-2xl font-bold uppercase tracking-wide text-foreground">
        <Video className="size-6 text-primary" /> Mapeamento do Sistema de Acesso
      </h2>
      <div className="relative aspect-square w-full max-w-[min(920px,82vh)]">
        {/* Rings */}
        <div className="absolute inset-[5%] rounded-full border-[3px] border-primary shadow-glow" />
        <div className="absolute inset-[20%] rounded-full border-[3px] border-primary/90 shadow-glow" />
        <span className="absolute bottom-[1%] left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-muted-foreground">
          Camada de Acesso Externo
        </span>
        <span className="absolute bottom-[16%] left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-muted-foreground">
          Camada de Acesso Interno
        </span>

        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
          <div className="flex size-20 sm:size-28 items-center justify-center rounded-full border-[3px] border-primary bg-background shadow-glow text-primary">
            <MonitorSpeaker className="size-9 sm:size-12" />
          </div>
          <span className="text-[11px] sm:text-sm font-semibold uppercase text-primary">Central Hub /<br />Chamada P2P</span>
        </div>

        {/* Layer labels when empty */}
        {(Object.keys(LAYER_GEO) as Layer[]).map((layer) => {
          if (rooms.some((r) => (r.layer ?? "work") === layer)) return null;
          const g = LAYER_GEO[layer];
          const rad = (((g.from + g.to) / 2) * Math.PI) / 180;
          return (
            <span
              key={layer}
              className="absolute -translate-x-1/2 -translate-y-1/2 max-w-[30%] text-center text-[10px] uppercase text-muted-foreground/70"
              style={{ left: `${50 + g.r * Math.cos(rad)}%`, top: `${50 + g.r * Math.sin(rad)}%` }}
            >
              {g.label}<br />(sem salas)
            </span>
          );
        })}

        {/* Room circles */}
        {nodes.map(({ room, layer, x, y }) => {
          const fallbackIcon: RoomIconName = layer === "project" ? "network" : layer === "external" ? "home" : "waves";
          const Icon = getRoomIcon(room.icon, fallbackIcon);
          const unlocked = isAdmin || access.has(room.id);
          return (
            <Button
              key={room.id}
              type="button"
              variant="ghost"
              onClick={() => open(room)}
              className="group absolute h-auto -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 p-0 hover:bg-transparent focus:outline-none"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={LAYER_GEO[layer].label}
            >
              <span
                className={cn(
                  "relative flex size-14 sm:size-20 items-center justify-center rounded-full border-[3px] border-primary bg-background text-primary shadow-glow transition-transform group-hover:scale-110 group-focus-visible:scale-110"
                )}
              >
                <Icon className="size-6 sm:size-9" />
                {!unlocked && (
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                    <Lock className="size-3" />
                  </span>
                )}
              </span>
              <span className="max-w-[140px] rounded bg-background/80 px-1 text-center text-[10px] sm:text-xs font-semibold uppercase text-primary">
                {room.name}
              </span>
              {unlocked && (
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                  {presenceCounts[room.id] ?? 0} online
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <RoomPasswordDialog
        room={pending}
        onClose={() => setPending(null)}
        onSuccess={(id) => {
          setPending(null);
          void navigate({ to: "/room/$roomId", params: { roomId: id } });
        }}
      />
    </div>
  );
}
