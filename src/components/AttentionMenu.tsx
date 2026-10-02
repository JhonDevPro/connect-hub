import { BellRing, UserRound, UsersRound } from "lucide-react";
import type { Member } from "@/hooks/useRoomSession";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AttentionMenuProps = {
  members: Member[];
  currentUserId: string;
  disabled?: boolean;
  onSend: (targetUserId?: string) => void;
};

export function AttentionMenu({
  members,
  currentUserId,
  disabled = false,
  onSend,
}: AttentionMenuProps) {
  const participants = members.filter(
    (member) => member.user_id !== currentUserId && member.peer_id,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="size-10 rounded-xl shadow sm:size-11"
          disabled={disabled || participants.length === 0}
          aria-label="Chamar atenção"
          title="Chamar atenção"
        >
          <BellRing className="size-4 text-live sm:size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-60">
        <DropdownMenuLabel>Chamar atenção</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onSend()}>
          <UsersRound />
          Todos na chamada
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Uma pessoa
        </DropdownMenuLabel>
        {participants.map((member) => (
          <DropdownMenuItem
            key={member.user_id}
            onSelect={() => onSend(member.user_id)}
          >
            <UserRound />
            <span className="truncate">{member.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}