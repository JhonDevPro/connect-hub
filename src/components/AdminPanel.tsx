import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LAYERS, type Layer } from "@/hooks/useAccess";
import { ROOM_ICONS, ROOM_ICON_NAMES, type RoomIconName } from "@/lib/room-icons";

const roomSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  description: z.string().trim().max(120),
});

type RoomForm = {
  name: string;
  description: string;
  password: string;
  layer: Layer;
  icon: RoomIconName;
};

const EMPTY_FORM: RoomForm = {
  name: "",
  description: "",
  password: "",
  layer: "work",
  icon: "waves",
};

export function AdminPanel({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});

  const list = useQuery({
    queryKey: ["admin-rooms"],
    enabled: open,
    queryFn: async () => {
      const [{ data: rooms }, { data: secrets }] = await Promise.all([
        supabase.from("rooms").select("id, name, description, layer, icon").order("created_at"),
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

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const validate = (requiresPassword: boolean) => {
    const values = roomSchema.parse(form);
    if (requiresPassword && form.password.length < 4) throw new Error("Senha com no mínimo 4 caracteres");
    if (form.password && form.password.length < 4) throw new Error("Senha com no mínimo 4 caracteres");
    if (form.password.length > 100) throw new Error("A senha deve ter no máximo 100 caracteres");
    return values;
  };

  const create = useMutation({
    mutationFn: async () => {
      const v = validate(true);
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: v.name, description: v.description || null, layer: form.layer, icon: form.icon, created_by: userId })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("room_secrets").insert({ room_id: data.id, password: v.password });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Sala criada");
      resetForm();
      refresh();
    },
    onError: (e: Error) => toast.error(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Dados inválidos") : e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Selecione uma sala para editar");
      const v = validate(false);
      const { error } = await supabase
        .from("rooms")
        .update({ name: v.name, description: v.description || null, layer: form.layer, icon: form.icon })
        .eq("id", editingId);
      if (error) throw error;
      if (form.password) {
        const { error: passwordError } = await supabase
          .from("room_secrets")
          .upsert({ room_id: editingId, password: form.password });
        if (passwordError) throw passwordError;
      }
    },
    onSuccess: () => {
      toast.success(form.password ? "Sala atualizada e acessos antigos revogados" : "Sala atualizada");
      resetForm();
      refresh();
    },
    onError: (e: Error) => toast.error(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Dados inválidos") : e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sala excluída"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar e gerenciar salas</DialogTitle>
          <DialogDescription>Crie ou edite o nome, a senha, o círculo e o ícone de cada sala.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2 sm:grid-cols-2 rounded-xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingId) update.mutate();
            else create.mutate();
          }}
        >
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {editingId ? "Editando sala" : "Nova sala"}
            </p>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1" onClick={resetForm}>
                <X className="size-3.5" /> Cancelar
              </Button>
            )}
          </div>
          <Input aria-label="Nome da sala" placeholder="Nome da sala" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            aria-label="Senha de acesso"
            type="password"
            placeholder={editingId ? "Nova senha (opcional)" : "Senha de acesso"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select
            aria-label="Círculo de acesso"
            value={form.layer}
            onChange={(e) => setForm({ ...form, layer: e.target.value as Layer })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {(Object.keys(LAYERS) as Layer[]).map((l) => <option key={l} value={l}>{LAYERS[l]}</option>)}
          </select>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ícone da sala</legend>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
              {ROOM_ICON_NAMES.map((name) => {
                const { Icon, label } = ROOM_ICONS[name];
                const selected = form.icon === name;
                return (
                  <Button
                    key={name}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="h-12 flex-col gap-0.5 px-1"
                    aria-label={`Ícone ${label}`}
                    aria-pressed={selected}
                    title={label}
                    onClick={() => setForm({ ...form, icon: name })}
                  >
                    <Icon className="size-4" />
                    <span className="max-w-full truncate text-[9px]">{label}</span>
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editingId ? (
              <><Check className="size-4" /> Salvar alterações</>
            ) : (
              <><Plus className="size-4" /> Criar sala com senha</>
            )}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salas e senhas</p>
          {list.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {list.data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 p-2 text-sm">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {(() => {
                  const iconName = r.icon in ROOM_ICONS ? r.icon as RoomIconName : "waves";
                  const RoomIcon = ROOM_ICONS[iconName].Icon;
                  return <RoomIcon className="size-4 shrink-0 text-primary" />;
                })()}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{LAYERS[(r.layer as Layer) ?? "work"]}</p>
                </div>
              </div>
              <code className="rounded bg-background px-2 py-1 text-xs text-primary">
                {show[r.id] ? r.password || "(sem senha)" : "••••••"}
              </code>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => setShow({ ...show, [r.id]: !show[r.id] })} aria-label="Mostrar senha">
                {show[r.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                size="icon" variant="ghost" className="size-8" aria-label={`Editar ${r.name}`} title="Editar sala"
                onClick={() => {
                  const icon = r.icon in ROOM_ICONS ? r.icon as RoomIconName : "waves";
                  setEditingId(r.id);
                  setForm({
                    name: r.name,
                    description: r.description ?? "",
                    password: "",
                    layer: (r.layer as Layer) ?? "work",
                    icon,
                  });
                }}
              >
                <Pencil className="size-4" />
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
