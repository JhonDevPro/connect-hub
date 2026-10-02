import {
  BriefcaseBusiness,
  Building2,
  Database,
  FolderKanban,
  Globe2,
  Headphones,
  Home,
  Network,
  Radio,
  Truck,
  Users,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const ROOM_ICONS = {
  video: { label: "Videochamada", Icon: Video },
  users: { label: "Equipe", Icon: Users },
  briefcase: { label: "Trabalho", Icon: BriefcaseBusiness },
  "folder-kanban": { label: "Projeto", Icon: FolderKanban },
  database: { label: "Dados", Icon: Database },
  "building-2": { label: "Empresa", Icon: Building2 },
  "globe-2": { label: "Externo", Icon: Globe2 },
  headphones: { label: "Suporte", Icon: Headphones },
  radio: { label: "Comunicação", Icon: Radio },
  truck: { label: "Transporte", Icon: Truck },
  home: { label: "Cliente", Icon: Home },
  waves: { label: "Grupo", Icon: Waves },
  network: { label: "Rede", Icon: Network },
} satisfies Record<string, { label: string; Icon: LucideIcon }>;

export type RoomIconName = keyof typeof ROOM_ICONS;

export const ROOM_ICON_NAMES = Object.keys(ROOM_ICONS) as RoomIconName[];

export function getRoomIcon(name: string | null | undefined, fallback: RoomIconName = "waves") {
  if (name && name in ROOM_ICONS) return ROOM_ICONS[name as RoomIconName].Icon;
  return ROOM_ICONS[fallback].Icon;
}