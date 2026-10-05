import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, MessageCircleReply, Paperclip, Send, SmilePlus, X } from "lucide-react";
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
  reply_to_id: string | null;
  created_at: string;
};

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type Profile = { id: string; display_name: string; avatar_url: string | null };
const REACTIONS = ["👍", "❤️", "😂", "🎉"] as const;

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
    void supabase.storage.from("chat-files").createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [path]);

  if (!path) return null;
  if (isImage) {
    return (
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block">
        {url ? <img src={url} alt={message.file_name ?? "imagem enviada"} loading="lazy" className="max-h-64 w-auto rounded-lg border border-border object-cover" /> : (
          <div className="flex h-32 w-48 items-center justify-center rounded-lg border border-border bg-accent/30"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
        )}
      </a>
    );
  }
  const isSheet = /sheet|excel|csv/.test(message.file_type ?? "");
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3 py-2 transition-colors hover:bg-accent/60">
      {isSheet ? <FileSpreadsheet className="size-5 text-primary" /> : <FileText className="size-5 text-primary" />}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{message.file_name}</span><span className="block text-xs text-muted-foreground">{formatSize(message.file_size)}</span></span>
    </a>
  );
}

export function ChatPanel({ roomId, userId, panelOpen = true, onUnreadChange }: { roomId: string; userId: string; panelOpen?: boolean; onUnreadChange?: (count: number) => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data as Message[];
    },
  });
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, avatar_url");
      if (error) throw error;
      return data as Profile[];
    },
  });
  const reactionsQuery = useQuery({
    queryKey: ["message-reactions", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_reactions").select("id, message_id, user_id, emoji").eq("room_id", roomId);
      if (error) throw error;
      return data as Reaction[];
    },
  });

  const nameOf = (id: string) => profilesQuery.data?.find((p) => p.id === id)?.display_name ?? "Membro";
  const messageById = useMemo(() => new Map((messagesQuery.data ?? []).map((message) => [message.id, message])), [messagesQuery.data]);
  const mentionQuery = text.match(/(?:^|\s)@([^\s@]*)$/)?.[1]?.toLocaleLowerCase("pt-BR");
  const mentionSuggestions = mentionQuery === undefined ? [] : (profilesQuery.data ?? []).filter((profile) => profile.id !== userId && profile.display_name.toLocaleLowerCase("pt-BR").includes(mentionQuery)).slice(0, 4);

  useEffect(() => {
    const channel = supabase.channel(`room-chat-${roomId}-${crypto.randomUUID()}`);
    channelRef.current = channel;
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, ({ new: row }) => {
        void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        const message = row as Message;
        if (message.user_id !== userId && !panelOpen) {
          setUnread((value) => value + 1);
          const sender = nameOf(message.user_id);
          toast.message(`${sender}: ${message.content ?? message.file_name ?? "Novo arquivo"}`);
          if (document.hidden && Notification.permission === "granted") new Notification(`Mensagem de ${sender}`, { body: message.content ?? message.file_name ?? "Novo arquivo" });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `room_id=eq.${roomId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["message-reactions", roomId] });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as { userId?: unknown; name?: unknown; active?: unknown };
        if (typing.userId === userId || typeof typing.name !== "string") return;
        setTypingNames((current) => typing.active ? Array.from(new Set([...current, typing.name as string])) : current.filter((name) => name !== typing.name));
      })
      .subscribe();
    return () => {
      channelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId, panelOpen, queryClient, profilesQuery.data]);

  useEffect(() => {
    if (panelOpen) setUnread(0);
  }, [panelOpen]);
  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messagesQuery.data?.length]);

  const send = useMutation({
    mutationFn: async (payload: Partial<Message>) => {
      const { error } = await supabase.from("messages").insert({ room_id: roomId, user_id: userId, ...payload });
      if (error) throw error;
    },
    onSuccess: () => { setReplyingTo(null); void queryClient.invalidateQueries({ queryKey: ["messages", roomId] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactionsQuery.data?.find((reaction) => reaction.message_id === messageId && reaction.user_id === userId && reaction.emoji === emoji);
    const result = existing
      ? await supabase.from("message_reactions").delete().eq("id", existing.id)
      : await supabase.from("message_reactions").insert({ message_id: messageId, room_id: roomId, user_id: userId, emoji });
    if (result.error) toast.error(result.error.message);
    else void queryClient.invalidateQueries({ queryKey: ["message-reactions", roomId] });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const path = `${userId}/${roomId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("chat-files").upload(path, file);
      if (error) throw error;
      await send.mutateAsync({ content: null, file_url: path, file_name: file.name, file_type: file.type, file_size: file.size, reply_to_id: replyingTo?.id ?? null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio do arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function announceTyping(value: string) {
    setText(value);
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "typing", payload: { userId, name: nameOf(userId), active: value.trim().length > 0 } });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => void channel.send({ type: "broadcast", event: "typing", payload: { userId, name: nameOf(userId), active: false } }), 1800);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messagesQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando conversa…</p>}
        {messagesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga um olá para o time.</p>}
        {messagesQuery.data?.map((message) => {
          const mine = message.user_id === userId;
          const reply = message.reply_to_id ? messageById.get(message.reply_to_id) : undefined;
          const grouped = REACTIONS.map((emoji) => ({ emoji, rows: reactionsQuery.data?.filter((reaction) => reaction.message_id === message.id && reaction.emoji === emoji) ?? [] })).filter((group) => group.rows.length > 0);
          return (
            <div key={message.id} className={cn("group flex flex-col", mine && "items-end")}>
              <span className="mb-1 text-xs text-muted-foreground">{mine ? "Você" : nameOf(message.user_id)} · {new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <div className={cn("max-w-[88%] rounded-xl border border-border px-3 py-2 text-sm", mine ? "bg-primary/15" : "bg-surface")}>
                {reply && <div className="mb-2 border-l-2 border-primary pl-2 text-xs text-muted-foreground"><strong>{nameOf(reply.user_id)}</strong><span className="block truncate">{reply.content ?? reply.file_name ?? "Arquivo"}</span></div>}
                {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                <Attachment message={message} />
              </div>
              <div className={cn("mt-1 flex flex-wrap items-center gap-1", mine && "justify-end")}>
                {grouped.map(({ emoji, rows }) => <Button key={emoji} type="button" variant="outline" size="sm" className={cn("h-6 gap-1 px-1.5 text-[11px]", rows.some((row) => row.user_id === userId) && "border-primary bg-primary/15")} onClick={() => void toggleReaction(message.id, emoji)}>{emoji} {rows.length}</Button>)}
                <Button type="button" variant="ghost" size="icon" className="size-6 opacity-60 group-hover:opacity-100" onClick={() => setReplyingTo(message)} aria-label="Responder"><MessageCircleReply className="size-3" /></Button>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><SmilePlus className="mr-1 size-3 self-center text-muted-foreground" />{REACTIONS.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="icon" className="size-6 text-xs" onClick={() => void toggleReaction(message.id, emoji)} aria-label={`Reagir com ${emoji}`}>{emoji}</Button>)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t border-border">
        {typingNames.length > 0 && <p className="absolute -top-6 inset-x-0 bg-sidebar px-4 py-1 text-[11px] text-muted-foreground">{typingNames.slice(0, 2).join(" e ")} {typingNames.length === 1 ? "está" : "estão"} digitando…</p>}
        {mentionSuggestions.length > 0 && <div className="absolute bottom-full left-10 right-3 mb-1 overflow-hidden rounded-md border border-border bg-popover shadow-panel">{mentionSuggestions.map((profile) => <Button key={profile.id} type="button" variant="ghost" className="w-full justify-start rounded-none text-xs" onClick={() => setText((value) => value.replace(/@[^\s@]*$/, `@${profile.display_name} `))}>@{profile.display_name}</Button>)}</div>}
        {replyingTo && <div className="flex items-center gap-2 bg-accent/30 px-3 py-2 text-xs"><MessageCircleReply className="size-3 text-primary" /><span className="min-w-0 flex-1 truncate">Respondendo a {nameOf(replyingTo.user_id)}: {replyingTo.content ?? replyingTo.file_name}</span><Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><X className="size-3" /></Button></div>}
        <form className="flex items-center gap-2 p-3" onSubmit={(event) => { event.preventDefault(); const value = text.trim(); if (!value) return; setText(""); send.mutate({ content: value, reply_to_id: replyingTo?.id ?? null }); }}>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.csv,.xls,.xlsx,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
          <Button type="button" variant="ghost" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()} aria-label="Anexar arquivo">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}</Button>
          <Input value={text} onChange={(event) => announceTyping(event.target.value)} placeholder="Mensagem ou @nome…" className="bg-background" />
          <Button type="submit" size="icon" aria-label="Enviar mensagem"><Send className="size-4" /></Button>
        </form>
      </div>
    </div>
  );
}