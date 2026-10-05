import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { SessionProfile } from "@/hooks/useSessionProfile";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024;

type Props = {
  profile: SessionProfile;
  onChanged: () => void | Promise<void>;
  compact?: boolean;
};

export function DisplayImageControl({ profile, onChanged, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  async function chooseImage(file: File) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error("Escolha uma imagem JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("A imagem pode ter no máximo 5 MB.");
      return;
    }

    setSaving(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const nextPath = `${profile.id}/display-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("profile-displays")
        .upload(nextPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_image_path: nextPath, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (updateError) {
        await supabase.storage.from("profile-displays").remove([nextPath]);
        throw updateError;
      }

      if (profile.displayImagePath) {
        await supabase.storage.from("profile-displays").remove([profile.displayImagePath]);
      }
      await onChanged();
      toast.success("Imagem de exibição salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a imagem.");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeImage() {
    if (!profile.displayImagePath) return;
    setSaving(true);
    const previousPath = profile.displayImagePath;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_image_path: null, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw error;
      await supabase.storage.from("profile-displays").remove([previousPath]);
      await onChanged();
      toast.success("Imagem de exibição removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a imagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void chooseImage(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size={compact ? "icon" : "sm"}
        className={compact ? "size-10 rounded-xl shadow sm:size-11" : "gap-2"}
        disabled={saving}
        onClick={() => inputRef.current?.click()}
        aria-label={profile.displayImagePath ? "Trocar imagem de exibição" : "Escolher imagem de exibição"}
        title={profile.displayImagePath ? "Trocar imagem quando a câmera estiver desligada" : "Escolher imagem quando a câmera estiver desligada"}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4 sm:size-5" />}
        {!compact && (profile.displayImagePath ? "Trocar imagem" : "Escolher imagem")}
      </Button>
      {profile.displayImagePath && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "size-10 rounded-xl sm:size-11" : "size-8"}
          disabled={saving}
          onClick={() => void removeImage()}
          aria-label="Remover imagem de exibição"
          title="Remover imagem de exibição"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}