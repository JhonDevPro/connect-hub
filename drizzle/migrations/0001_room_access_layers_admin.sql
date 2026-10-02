CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.rooms ADD COLUMN layer text NOT NULL DEFAULT 'work';
ALTER TABLE public.rooms ADD CONSTRAINT rooms_layer_check CHECK (layer IN ('project','work','external'));

CREATE TABLE public.room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_secrets TO authenticated;
GRANT ALL ON public.room_secrets TO service_role;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_secrets_admin_all ON public.room_secrets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.room_access (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT ON public.room_access TO authenticated;
GRANT ALL ON public.room_access TO service_role;
ALTER TABLE public.room_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_access_select_own ON public.room_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_room_access(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.room_access WHERE room_id = _room_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.verify_room_password(_room_id uuid, _password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT password = _password INTO ok FROM public.room_secrets WHERE room_id = _room_id;
  IF coalesce(ok, false) THEN
    INSERT INTO public.room_access (room_id, user_id) VALUES (_room_id, auth.uid())
    ON CONFLICT (room_id, user_id) DO UPDATE SET granted_at = now();
    RETURN true;
  END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.verify_room_password(uuid, text) TO authenticated;

-- Password change revokes previously granted access
CREATE OR REPLACE FUNCTION public.revoke_room_access_on_password_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.password IS DISTINCT FROM OLD.password THEN
    DELETE FROM public.room_access WHERE room_id = NEW.room_id;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER room_secrets_pw_change BEFORE UPDATE ON public.room_secrets
FOR EACH ROW EXECUTE FUNCTION public.revoke_room_access_on_password_change();

-- Rooms: only admin creates/deletes/updates
DROP POLICY IF EXISTS rooms_delete_auth ON public.rooms;
DROP POLICY IF EXISTS rooms_insert_auth ON public.rooms;
GRANT UPDATE ON public.rooms TO authenticated;
CREATE POLICY rooms_insert_admin ON public.rooms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY rooms_delete_admin ON public.rooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY rooms_update_admin ON public.rooms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Messages: only room members
DROP POLICY IF EXISTS messages_select_auth ON public.messages;
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_select_room ON public.messages FOR SELECT TO authenticated USING (public.has_room_access(room_id));
CREATE POLICY messages_insert_room ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_room_access(room_id));