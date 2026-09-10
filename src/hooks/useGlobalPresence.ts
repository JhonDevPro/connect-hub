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

export function useGlobalPresence(currentProfile: SessionProfile | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // 1. Carrega todos os perfis cadastrados no sistema
  useEffect(() => {
    let active = true;

    async function loadAllProfiles() {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url");

      if (!active || !data) return;

      setMembers((prev) => {
        // Mapeia perfis existentes
        return data.map((p) => {
          const isMe = currentProfile?.id === p.id;
          return {
            id: p.id,
            name: p.display_name || (isMe ? currentProfile?.name || "Você" : "Membro"),
            email: isMe ? currentProfile?.email ?? null : null,
            avatar: p.avatar_url,
            isOnline: false,
          };
        });
      });
    }

    void loadAllProfiles();

    // Atualiza se houver novos perfis inseridos
    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void loadAllProfiles()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.email]);

  // 2. Canal de presença global em tempo real (quem está online agora)
  useEffect(() => {
    if (!currentProfile?.id) return;

    const channel = supabase.channel("global-online-presence", {
      config: { presence: { key: currentProfile.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          user_id: string;
          name: string;
          email: string | null;
          avatar: string | null;
        }>();

        const onlineIds = new Set<string>();
        const presenceDataMap = new Map<string, { email: string | null; name: string }>();

        for (const [key, entries] of Object.entries(state)) {
          const entry = entries[entries.length - 1];
          if (entry) {
            onlineIds.add(entry.user_id || key);
            if (entry.email || entry.name) {
              presenceDataMap.set(entry.user_id || key, {
                email: entry.email,
                name: entry.name,
              });
            }
          }
        }

        setOnlineUserIds(onlineIds);

        // Atualiza os membros combinando perfis com dados online
        setMembers((prev) => {
          // Garante que o usuário atual esteja na lista
          const map = new Map<string, TeamMember>();
          prev.forEach((m) => map.set(m.id, { ...m, isOnline: onlineIds.has(m.id) }));

          // Adiciona ou atualiza dados recebidos da presença
          onlineIds.forEach((uid) => {
            const data = presenceDataMap.get(uid);
            const existing = map.get(uid);
            if (existing) {
              existing.isOnline = true;
              if (data?.email && !existing.email) existing.email = data.email;
              if (data?.name && existing.name === "Membro") existing.name = data.name;
            } else if (data) {
              map.set(uid, {
                id: uid,
                name: data.name || "Membro",
                email: data.email,
                avatar: null,
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
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentProfile.id,
            name: currentProfile.name,
            email: currentProfile.email,
            avatar: currentProfile.avatar,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.email, currentProfile?.avatar]);

  return { members, onlineCount: onlineUserIds.size };
}
