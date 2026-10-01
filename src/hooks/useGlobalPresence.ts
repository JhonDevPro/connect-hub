import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SessionProfile } from "./useSessionProfile";

export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  isOnline: boolean;
};

type PresenceInfo = { email: string | null; name: string; avatar: string | null };
type PresencePayload = { user_id: string; name: string; email: string | null; avatar: string | null };
type Listener = (data: Map<string, PresenceInfo>) => void;

// Canal único compartilhado: o Supabase não permite dois canais com o mesmo nome
let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedKey: string | null = null;
let lastData = new Map<string, PresenceInfo>();
const listeners = new Set<Listener>();

function subscribeGlobalPresence(me: PresencePayload, listener: Listener) {
  listeners.add(listener);

  if (sharedChannel && sharedKey !== me.user_id) {
    void supabase.removeChannel(sharedChannel);
    sharedChannel = null;
  }

  if (!sharedChannel) {
    sharedKey = me.user_id;
    const channel = supabase.channel("team-presence-global", {
      config: { presence: { key: me.user_id } },
    });
    sharedChannel = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const map = new Map<string, PresenceInfo>();
        for (const [key, entries] of Object.entries(state)) {
          const entry = entries[entries.length - 1];
          if (entry) {
            map.set(entry.user_id || key, {
              email: entry.email || null,
              name: entry.name || "Membro",
              avatar: entry.avatar || null,
            });
          }
        }
        lastData = map;
        listeners.forEach((l) => l(map));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track(me);
      });
  } else {
    listener(lastData);
    void sharedChannel.track(me);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && sharedChannel) {
      const ch = sharedChannel;
      sharedChannel = null;
      sharedKey = null;
      lastData = new Map();
      void supabase.removeChannel(ch);
    }
  };
}

export function useGlobalPresence(currentProfile: SessionProfile | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // 1. Carrega todos os perfis cadastrados no sistema
  useEffect(() => {
    let active = true;

    async function loadAllProfiles() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url");

        if (!active || error || !data) return;

        setMembers((prev) => {
          const map = new Map<string, TeamMember>();
          prev.forEach((m) => map.set(m.id, m));

          data.forEach((p) => {
            const isMe = currentProfile?.id === p.id;
            const existing = map.get(p.id);
            map.set(p.id, {
              id: p.id,
              name: p.display_name || (isMe ? currentProfile?.name || "Você" : existing?.name || "Membro"),
              email: isMe ? currentProfile?.email ?? null : existing?.email ?? null,
              avatar: p.avatar_url || existing?.avatar || null,
              isOnline: existing?.isOnline || false,
            });
          });

          if (currentProfile && !map.has(currentProfile.id)) {
            map.set(currentProfile.id, {
              id: currentProfile.id,
              name: currentProfile.name,
              email: currentProfile.email,
              avatar: currentProfile.avatar,
              isOnline: true,
            });
          }

          return Array.from(map.values());
        });
      } catch (err) {
        console.error("Erro ao carregar perfis:", err);
      }
    }

    void loadAllProfiles();

    // Recarrega periodicamente a cada 45 segundos de forma silenciosa
    const interval = setInterval(() => {
      void loadAllProfiles();
    }, 45000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.email]);

  // 2. Canal de presença global compartilhado (um único canal para todos os componentes)
  useEffect(() => {
    if (!currentProfile?.id) return;

    const onSync = (presenceDataMap: Map<string, PresenceInfo>) => {
      const onlineIds = new Set(presenceDataMap.keys());
      setOnlineUserIds(onlineIds);

      setMembers((prev) => {
        const map = new Map<string, TeamMember>();
        prev.forEach((m) => map.set(m.id, { ...m, isOnline: onlineIds.has(m.id) }));

        onlineIds.forEach((uid) => {
          const onlineData = presenceDataMap.get(uid);
          const existing = map.get(uid);
          if (existing) {
            existing.isOnline = true;
            if (onlineData?.email && !existing.email) existing.email = onlineData.email;
            if (onlineData?.name && existing.name === "Membro") existing.name = onlineData.name;
            if (onlineData?.avatar && !existing.avatar) existing.avatar = onlineData.avatar;
          } else if (onlineData) {
            map.set(uid, {
              id: uid,
              name: onlineData.name || "Membro",
              email: onlineData.email,
              avatar: onlineData.avatar,
              isOnline: true,
            });
          }
        });

        if (currentProfile && !map.has(currentProfile.id)) {
          map.set(currentProfile.id, {
            id: currentProfile.id,
            name: currentProfile.name,
            email: currentProfile.email,
            avatar: currentProfile.avatar,
            isOnline: true,
          });
        }

        return Array.from(map.values()).sort((a, b) => {
          if (a.isOnline === b.isOnline) return a.name.localeCompare(b.name);
          return a.isOnline ? -1 : 1;
        });
      });
    };

    return subscribeGlobalPresence(
      {
        user_id: currentProfile.id,
        name: currentProfile.name,
        email: currentProfile.email,
        avatar: currentProfile.avatar,
      },
      onSync,
    );
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.email, currentProfile?.avatar]);

  return { members, onlineCount: onlineUserIds.size };
}
