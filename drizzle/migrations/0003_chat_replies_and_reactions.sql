ALTER TABLE public.messages
  ADD COLUMN reply_to_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '🎉')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reactions_select_room"
ON public.message_reactions FOR SELECT TO authenticated
USING (public.has_room_access(room_id));

CREATE POLICY "message_reactions_insert_room"
ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.has_room_access(room_id)
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND m.room_id = room_id
  )
);

CREATE POLICY "message_reactions_delete_own"
ON public.message_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX message_reactions_message_id_idx ON public.message_reactions(message_id);
CREATE INDEX messages_reply_to_id_idx ON public.messages(reply_to_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;