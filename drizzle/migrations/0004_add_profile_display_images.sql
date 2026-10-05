ALTER TABLE public.profiles
ADD COLUMN display_image_path text;

CREATE POLICY "profile_displays_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-displays');

CREATE POLICY "profile_displays_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-displays'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_displays_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-displays'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-displays'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_displays_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-displays'
  AND (storage.foldername(name))[1] = auth.uid()::text
);