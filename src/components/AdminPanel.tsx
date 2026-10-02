import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LAYERS, type Layer } from "@/hooks/useAccess";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  description: z.string().trim().max(120),
  password: z.string().min(4, "Senha com no mínimo 4 caracteres").max(100),
});

export function AdminPanel({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", password: "", layer: "work" as Layer });
  const [show, setShow] = useState<Record<string, boolean>>({});

  const list = useQuery({
    queryKey: ["admin-rooms"],
    enabled: open,
    queryFn: async () => {
      const [{ data: rooms }, { data: secrets }] = await Promise.all([
        supabase.from("rooms").select("id, name, description, layer").order("created_at"),
        supabase.from("room_secrets").select("room_id, password"),
      ]);
      const map = new Map((secrets ?? []).map((s) => [s.room_id, s.password]));
      return (rooms ?? []).map((r) => ({ ...r, password: map.get(r.id) ?? "" }));
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-rooms"] });
    void qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const v = schema.parse(form);
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: v.name, description: v.description || null, layer: form.layer, created_by: userId })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("room_secrets").insert({ room_id: data.id, password: v.password });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Sala criada");
      setForm({ name: "", description: "", password: "", layer: form.layer });
      refresh();
    },
    onError: (e: Error) => toast.error(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Dados inválidos") : e.message),
  });

  const changePw = useMutation({
    mutationFn: async ({ id, pw }: { id: string; pw: string }) => {
      const { error } = await supabase.from("room_secrets").upsert({ room_id: id, password: pw });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Senha alterada — acessos anteriores revogados"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sala excluída"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar e gerenciar salas</DialogTitle>
          <DialogDescription>Crie um círculo com senha ou gerencie as salas existentes.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2 sm:grid-cols-2 rounded-xl border border-border p-3"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <Input placeholder="Nome da sala" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Senha de acesso" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select
            value={form.layer}
            onChange={(e) => setForm({ ...form, layer: e.target.value as Layer })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {(Object.keys(LAYERS) as Layer[]).map((l) => <option key={l} value={l}>{LAYERS[l]}</option>)}
          </select>
          <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Criar sala com senha"}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salas e senhas</p>
          {list.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {list.data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{LAYERS[(r.layer as Layer) ?? "work"]}</p>
              </div>
              <code className="rounded bg-background px-2 py-1 text-xs text-primary">
                {show[r.id] ? r.password || "(sem senha)" : "••••••"}
              </code>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => setShow({ ...show, [r.id]: !show[r.id] })} aria-label="Mostrar senha">
                {show[r.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                size="icon" variant="ghost" className="size-8" aria-label="Trocar senha"
                onClick={() => {
                  const pw = window.prompt(`Nova senha para "${r.name}":`);
                  if (pw && pw.length >= 4) changePw.mutate({ id: r.id, pw });
                  else if (pw) toast.error("Senha com no mínimo 4 caracteres");
                }}
              >
                <KeyRound className="size-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Excluir sala"
                onClick={() => { if (window.confirm(`Excluir "${r.name}" e todas as mensagens?`)) remove.mutate(r.id); }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
