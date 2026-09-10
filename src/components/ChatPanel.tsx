import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  room_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

type Profile = { id: string; display_name: string; avatar_url: string | null };

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Attachment({ message }: { message: Message }) {
  const [url, setUrl] = useState<string | null>(null);
  const path = message.file_url;
  const isImage = message.file_type?.startsWith("image/") ?? false;

  useEffect(() => {
    if (!path) return;
    let active = true;
    void supabase.storage
      .from("chat-files")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) return null;

  if (isImage) {
    return (
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block">
        {url ? (
          <img
            src={url}
            alt={message.file_name ?? "imagem enviada"}
            loading="lazy"
            className="max-h-64 w-auto rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-32 w-48 items-center justify-center rounded-lg border border-border bg-accent/30">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </a>
    );
  }

  const isSheet = /sheet|excel|csv/.test(message.file_type ?? "");

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3 py-2 transition-colors hover:bg-accent/60"
    >
      {isSheet ? (
        <FileSpreadsheet className="size-5 text-primary" />
      ) : (
        <FileText className="size-5 text-primary" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{message.file_name}</span>
        <span className="block text-xs text-muted-foreground">
          {formatSize(message.file_size)}
        </span>
      </span>
    </a>
  );
}

export function ChatPanel({ roomId, userId }: { roomId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as Message[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url");
      if (error) throw error;
      return data as Profile[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length]);

  const send = useMutation({
    mutationFn: async (payload: Partial<Message>) => {
      const { error } = await supabase.from("messages").insert({
        room_id: roomId,
        user_id: userId,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const path = `${userId}/${roomId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("chat-files").upload(path, file);
      if (error) throw error;
      await send.mutateAsync({
        content: null,
        file_url: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio do arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const nameOf = (id: string) =>
    profilesQuery.data?.find((p) => p.id === id)?.display_name ?? "Membro";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messagesQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando conversa…</p>
        )}
        {messagesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Diga um olá para o time.
          </p>
        )}
        {messagesQuery.data?.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={cn("flex flex-col", mine && "items-end")}>
              <span className="mb-1 text-xs text-muted-foreground">
                {mine ? "Você" : nameOf(m.user_id)} ·{" "}
                {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl border border-border px-3 py-2 text-sm",
                  mine ? "bg-primary/15" : "bg-surface",
                )}
              >
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                <Attachment message={m} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          setText("");
          send.mutate({ content: value });
        }}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.xls,.xlsx,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          aria-label="Anexar arquivo"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          className="bg-background"
        />
        <Button type="submit" size="icon" aria-label="Enviar mensagem">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
