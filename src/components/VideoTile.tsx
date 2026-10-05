import { useEffect, useRef, useState } from "react";
import { Hand, Mic, MicOff, VideoOff, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Props = {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  mirror?: boolean;
  camOn?: boolean;
  micOn?: boolean;
  deafened?: boolean;
  raisedHand?: boolean;
  displayImagePath?: string | null;
  /** Stable participant id used to remember this person's volume on this device */
  volumeKey?: string | undefined;
};

const VOLUME_STORAGE = "nexo-participant-volumes";

function readVolumes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VOLUME_STORAGE) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function VideoTile({
  stream,
  name,
  isLocal = false,
  mirror = isLocal,
  camOn = true,
  micOn = true,
  deafened = false,
  raisedHand = false,
  displayImagePath = null,
  volumeKey,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(100);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!displayImagePath) {
      setDisplayImageUrl(null);
      return undefined;
    }
    void import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.storage.from("profile-displays").createSignedUrl(displayImagePath, 3600),
    ).then(({ data }) => {
      if (active) setDisplayImageUrl(data?.signedUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [displayImagePath]);

  useEffect(() => {
    if (!volumeKey) return;
    const saved = readVolumes()[volumeKey];
    if (typeof saved === "number") setVolume(saved);
  }, [volumeKey]);

  const changeVolume = (v: number) => {
    setVolume(v);
    if (!volumeKey) return;
    const all = readVolumes();
    all[volumeKey] = v;
    localStorage.setItem(VOLUME_STORAGE, JSON.stringify(all));
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = isLocal || deafened;
    el.volume = Math.min(1, Math.max(0, volume / 100));
  }, [volume, deafened, isLocal]);

  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted={isLocal || deafened}
        className={cn(
          "h-full w-full object-cover transition-opacity",
          mirror && "-scale-x-100",
          camOn ? "opacity-100" : "opacity-0",
        )}
      />

      {!camOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-accent/40">
          {displayImageUrl ? (
            <img src={displayImageUrl} alt={`Imagem de exibição de ${name}`} className="absolute inset-0 size-full object-contain" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-secondary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <VideoOff className="size-3" /> câmera desligada
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2">
        <span className="pointer-events-auto rounded-md bg-background/70 px-2 py-1 text-xs font-medium backdrop-blur">
          {name}
          {isLocal && " (você)"}
        </span>
        <span
          className={cn(
            "pointer-events-auto rounded-md bg-background/70 p-1 backdrop-blur",
            micOn ? "text-primary" : "text-muted-foreground",
          )}
        >
          {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
        </span>
      </div>

      {raisedHand && (
        <span className="absolute right-2 top-11 flex items-center gap-1 rounded-full border border-primary/40 bg-background/90 px-2 py-1 text-xs font-semibold text-primary shadow-panel">
          <Hand className="size-3.5" /> Mão levantada
        </span>
      )}

      {!isLocal && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-background/90 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Volume2 className="size-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={150}
            step={5}
            onValueChange={(v) => changeVolume(v[0] ?? 0)}
            aria-label={`Volume de ${name}`}
          />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {volume}%
          </span>
        </div>
      )}
    </div>
  );
}
