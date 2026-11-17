-- The active account UI offers these three avatar choices. Keep the two
-- legacy values valid for any older client or restored profile data.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_avatar_type_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_avatar_type_check
  CHECK (avatar_type IN (
    'helmet', 'pit-wall', 'timing', 'constructor_logo', 'driver_image'
  ));
ALTER TABLE public.user_profiles
  ALTER COLUMN avatar_type SET DEFAULT 'helmet';
