-- 1. super_admin role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- 2. Districts
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  province public.sa_province NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province, name)
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view districts" ON public.districts FOR SELECT USING (true);

-- 3. is_super_admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

-- 4. Super-admin manages districts
CREATE POLICY "Super admins manage districts" ON public.districts
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. district_id on schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;

-- 6. Super-admins manage schools
CREATE POLICY "Super admins insert schools" ON public.schools FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins update all schools" ON public.schools FOR UPDATE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins delete schools" ON public.schools FOR DELETE USING (public.is_super_admin(auth.uid()));

-- 7. Super-admins manage user_roles
CREATE POLICY "Super admins view all roles" ON public.user_roles FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins update roles" ON public.user_roles FOR UPDATE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins delete roles" ON public.user_roles FOR DELETE USING (public.is_super_admin(auth.uid()));

-- 8. Super-admins view all profiles
CREATE POLICY "Super admins view all profiles" ON public.profiles FOR SELECT USING (public.is_super_admin(auth.uid()));

-- 9. updated_at trigger
DROP TRIGGER IF EXISTS districts_touch_updated ON public.districts;
CREATE TRIGGER districts_touch_updated BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. Seed Western Cape Metro districts
INSERT INTO public.districts (name, province, code) VALUES
  ('Metro Central', 'Western Cape', 'WC-MC'),
  ('Metro East', 'Western Cape', 'WC-ME'),
  ('Metro North', 'Western Cape', 'WC-MN'),
  ('Metro South', 'Western Cape', 'WC-MS')
ON CONFLICT (province, name) DO NOTHING;