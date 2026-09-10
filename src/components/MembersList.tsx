import { Mail } from "lucide-react";
import type { TeamMember } from "@/hooks/useGlobalPresence";
import { cn } from "@/lib/utils";

export function MembersList({
  members,
  title = "Membros da Equipe",
}: {
  members: TeamMember[];
  title?: string;
}) {
  const onlineCount = members.filter((m) => m.isOnline).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title} ({members.length})
        </p>
        <span className="text-[11px] font-medium text-emerald-400">
          {onlineCount} online
        </span>
      </div>

      <div className="space-y-1.5">
        {members.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground text-center">
            Nenhum membro registrado ainda.
          </p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface border border-transparent hover:border-border/60"
            >
              {/* Avatar com indicador de status Verde (online) ou Vermelho (offline) */}
              <div className="relative shrink-0">
                <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-foreground">
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    (m.name || "?").slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Pontinho de status: Verde para online, Vermelho para offline */}
                <span
                  title={m.isOnline ? "Online" : "Offline"}
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar shadow-sm transition-colors",
                    m.isOnline
                      ? "bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse"
                      : "bg-red-500/80"
                  )}
                />
              </div>

              {/* Informações: Nome e E-mail */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-medium text-foreground">
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      m.isOnline ? "text-emerald-400" : "text-muted-foreground/60"
                    )}
                  >
                    {m.isOnline ? "Online" : "Offline"}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="size-3 shrink-0 opacity-70" />
                  <span className="truncate font-mono text-[11px]">
                    {m.email || "Sem e-mail cadastrado"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
