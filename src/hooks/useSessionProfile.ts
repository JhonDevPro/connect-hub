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

    // Seta imediatamente com os dados locais do token para não bloquear a UI
    setProfile({
      id: current.id,
      name: fallbackName,
      avatar,
      email,
    });
    setLoading(false);

    // Em segundo plano, busca e sincroniza no banco
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", current.id)
        .maybeSingle();

      const profileName = existing?.display_name || fallbackName;
      const profileAvatar = existing?.avatar_url || avatar;

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
      // Ignora erro de rede/banco, o perfil já está setado com o token
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Escuta mudanças de auth em tempo real (INITIAL_SESSION, SIGNED_IN, etc)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (session?.user) {
          void syncProfile(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Checa sessão inicial existente
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        if (data.session?.user) {
          void syncProfile(data.session.user);
        } else {
          // Pequeno timeout defensivo para garantir que o storage foi lido
          setTimeout(() => {
            if (active) {
              setLoading(false);
            }
          }, 300);
        }
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncProfile]);

  return { user, profile, loading, reload: () => syncProfile(user) };
}
