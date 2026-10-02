import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin(userId?: string | null) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
}

export function useRoomAccessList(userId?: string | null) {
  return useQuery({
    queryKey: ["room-access", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return new Set<string>();
      const { data } = await supabase.from("room_access").select("room_id").eq("user_id", userId);
      return new Set((data ?? []).map((r) => r.room_id));
    },
  });
}

export async function verifyRoomPassword(roomId: string, password: string) {
  const { data, error } = await supabase.rpc("verify_room_password", {
    _room_id: roomId,
    _password: password,
  });
  if (error) throw error;
  return !!data;
}

export const LAYERS = {
  project: "Nível 2 - Grupos de Projeto / Dados",
  work: "Nível 2 - Grupos de Trabalho",
  external: "Nível 3 - Acesso Externo / Clientes",
} as const;
export type Layer = keyof typeof LAYERS;
