import { Mic, MicOff, Video } from "lucide-react";
import type { Member } from "@/hooks/useRoomSession";

export function MembersList({ members }: { members: Member[] }) {
  return (
    <div className="space-y-1">
      <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Online — {members.length}
      </p>
      {members.map((m) => (
        <div
          key={m.user_id}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40"
        >
          <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold">
            {m.avatar ? (
              <img src={m.avatar} alt="" className="size-full object-cover" />
            ) : (
              m.name.slice(0, 1).toUpperCase()
            )}
            <span className="absolute -bottom-0 -right-0 size-2.5 rounded-full border-2 border-surface bg-primary" />
          </span>
          <span className="min-w-0 flex-1 truncate">{m.name}</span>
          {m.peer_id && <Video className="size-3.5 text-primary" />}
          {m.peer_id &&
            (m.mic_on ? (
              <Mic className="size-3.5 text-primary" />
            ) : (
              <MicOff className="size-3.5 text-muted-foreground" />
            ))}
        </div>
      ))}
    </div>
  );
}
