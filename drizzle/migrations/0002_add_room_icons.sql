ALTER TABLE public.rooms
ADD COLUMN icon text NOT NULL DEFAULT 'waves';

UPDATE public.rooms
SET icon = CASE layer
  WHEN 'project' THEN 'network'
  WHEN 'external' THEN 'home'
  ELSE 'waves'
END;

ALTER TABLE public.rooms
ADD CONSTRAINT rooms_icon_check CHECK (
  icon IN (
    'video',
    'users',
    'briefcase',
    'folder-kanban',
    'database',
    'building-2',
    'globe-2',
    'headphones',
    'radio',
    'truck',
    'home',
    'waves',
    'network'
  )
);