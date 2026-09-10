import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionProfile = {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
};

/** Loads the signed-in user and makes sure a profile row exists for them with Google/Email info. */
export function useSessionProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = useCallback(async (current: User | null) => {
    if (!current) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setUser(current);

    const meta = current.user_metadata ?? {};
    const fallbackName =
      (meta["full_name"] as string | undefined) ??
      (meta["name"] as string | undefined) ??
      (meta["display_name"] as string | undefined) ??
      current.email?.split("@")[0] ??
      "Membro";
    const avatar =
      (meta["avatar_url"] as string | undefined) ??
      (meta["picture"] as string | undefined) ??
      null;
    const email = current.email ?? null;

    try {
      // Tenta buscar o perfil existente
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", current.id)
        .maybeSingle();

      const profileName = existing?.display_name || fallbackName;
      const profileAvatar = existing?.avatar_url || avatar;

      // Upsert seguro garantindo que o perfil está no banco
      if (!existing) {
        await supabase.from("profiles").upsert(
          {
            id: current.id,
            display_name: profileName,
            avatar_url: profileAvatar,
          },
          { onConflict: "id" }
        );
      }

      setProfile({
        id: current.id,
        name: profileName,
        avatar: profileAvatar,
        email,
      });
    } catch {
      // Fallback local se o banco falhar
      setProfile({
        id: current.id,
        name: fallbackName,
        avatar,
        email,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // 1. Obtém sessão atual
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        void syncProfile(data.session?.user ?? null);
      }
    });

    // 2. Escuta mudanças na autenticação em tempo real (ex: retorno do Google OAuth)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          void syncProfile(session?.user ?? null);
        }
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncProfile]);

  return { user, profile, loading, reload: () => syncProfile(user) };
}
