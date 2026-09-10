import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SessionProfile } from "./useSessionProfile";

export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  isOnline: boolean;
};

export function useGlobalPresence(currentProfile: SessionProfile | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  // 2. Canal de presença global em tempo real (quem está online agora)
  useEffect(() => {
    if (!currentProfile?.id) return;

    let active = true;
    const channelId = `presence-${currentProfile.id}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(channelId, {
      config: { presence: { key: currentProfile.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        if (!active) return;
        const state = channel.presenceState<{
          user_id: string;
          name: string;
          email: string | null;
          avatar: string | null;
        }>();

        const onlineIds = new Set<string>();
        const presenceDataMap = new Map<string, { email: string | null; name: string; avatar: string | null }>();

        for (const [key, entries] of Object.entries(state)) {
          const entry = entries[entries.length - 1];
          if (entry) {
            const uid = entry.user_id || key;
            onlineIds.add(uid);
            presenceDataMap.set(uid, {
              email: entry.email || null,
              name: entry.name || "Membro",
              avatar: entry.avatar || null,
            });
          }
        }

        setOnlineUserIds(onlineIds);

        setMembers((prev) => {
          const map = new Map<string, TeamMember>();
          prev.forEach((m) => map.set(m.id, { ...m, isOnline: onlineIds.has(m.id) }));

          // Adiciona quem estiver online no canal
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
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && active) {
          void channel.track({
            user_id: currentProfile.id,
            name: currentProfile.name,
            email: currentProfile.email,
            avatar: currentProfile.avatar,
          });
        }
      });

    return () => {
      active = false;
      channelRef.current = null;
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.email, currentProfile?.avatar]);

  return { members, onlineCount: onlineUserIds.size };
}
