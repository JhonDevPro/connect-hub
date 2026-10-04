import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceEntry = { user_id?: string };

export function useRoomPresenceCounts(roomIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = [...roomIds].sort().join(",");

  useEffect(() => {
    if (roomIds.length === 0) {
      setCounts({});
      return;
    }

    const channels = roomIds.map((roomId) => {
      const channel = supabase.channel(`room-presence-${roomId}`);
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<PresenceEntry>();
          const users = new Set<string>();
          Object.entries(state).forEach(([key, entries]) => {
            const entry = entries[entries.length - 1];
            users.add(entry?.user_id || key);
          });
          setCounts((current) => ({ ...current, [roomId]: users.size }));
        })
        .subscribe();
      return channel;
    });

    return () => {
      channels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [key]);

  return counts;
}