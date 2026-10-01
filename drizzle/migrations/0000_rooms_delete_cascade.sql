ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_room_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS rooms_delete_own ON public.rooms;
CREATE POLICY rooms_delete_auth ON public.rooms FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);