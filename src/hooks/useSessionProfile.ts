import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionProfile = {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
};

/** Loads the signed-in user and makes sure a profile row exists for them. */
export function useSessionProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const current = data.user ?? null;
      if (!active) return;
      setUser(current);

      if (!current) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const meta = current.user_metadata ?? {};
      const fallbackName =
        (meta['full_name'] as string | undefined) ??
        (meta['name'] as string | undefined) ??
        current.email?.split("@")[0] ??
        "Membro";
      const avatar =
        (meta['avatar_url'] as string | undefined) ??
        (meta['picture'] as string | undefined) ??
        null;

      const { data: existing } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", current.id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from("profiles")
          .insert({ id: current.id, display_name: fallbackName, avatar_url: avatar });
      }

      if (!active) return;
      setProfile({
        id: current.id,
        name: existing?.display_name ?? fallbackName,
        avatar: existing?.avatar_url ?? avatar,
        email: current.email ?? null,
      });
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { user, profile, loading };
}
