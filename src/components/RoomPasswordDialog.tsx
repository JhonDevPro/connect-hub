import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyRoomPassword } from "@/hooks/useAccess";

export function RoomPasswordDialog({
  room,
  onClose,
  onSuccess,
}: {
  room: { id: string; name: string } | null;
  onClose: () => void;
  onSuccess: (roomId: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!room || !pw) return;
    setBusy(true);
    setError("");
    try {
      const ok = await verifyRoomPassword(room.id, pw);
      if (!ok) {
        setError("Senha incorreta.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["room-access"] });
      setPw("");
      onSuccess(room.id);
    } catch {
      setError("Não foi possível verificar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!room} onOpenChange={(o) => { if (!o) { setPw(""); setError(""); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-primary" /> {room?.name}
          </DialogTitle>
          <DialogDescription>Digite a senha de acesso desta sala.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            autoFocus
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Senha da sala"
            maxLength={100}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !pw}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Entrar na sala"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
