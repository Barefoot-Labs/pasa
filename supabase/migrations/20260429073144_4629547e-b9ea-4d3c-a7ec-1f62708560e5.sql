
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('parent','teacher','principal','school_admin','super_admin');
CREATE TYPE public.school_phase AS ENUM ('primary','secondary','combined');
CREATE TYPE public.school_type AS ENUM ('public','independent','private','special');
CREATE TYPE public.sa_province AS ENUM ('Western Cape','Gauteng','KwaZulu-Natal','Eastern Cape','Free State','Limpopo','Mpumalanga','Northern Cape','North West');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');
CREATE TYPE public.discipline_type AS ENUM ('merit','warning','detention','suspension','incident');
CREATE TYPE public.transfer_status AS ENUM ('pending','approved','rejected','completed');
CREATE TYPE public.subscription_tier AS ENUM ('free','premium');

-- =========== REFERENCE TABLES ===========
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emis_number TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  province sa_province NOT NULL,
  phase school_phase NOT NULL,
  school_type school_type NOT NULL DEFAULT 'public',
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  principal_name TEXT,
  established_year INT,
  learner_count INT DEFAULT 0,
  fees_annual NUMERIC(10,2),
  language_of_instruction TEXT[] DEFAULT ARRAY['English'],
  description TEXT,
  logo_url TEXT,
  motto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_schools_province ON public.schools(province);
CREATE INDEX idx_schools_district ON public.schools(district);

CREATE TABLE public.grades (
  id INT PRIMARY KEY,
  label TEXT NOT NULL,
  phase school_phase NOT NULL
);

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  phase school_phase NOT NULL
);

-- =========== PROFILES & ROLES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  id_number TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  supports_school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, school_id)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_school ON public.user_roles(school_id);

-- =========== LEARNERS ===========
CREATE TABLE public.learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  grade_id INT NOT NULL REFERENCES public.grades(id),
  learner_number TEXT,
  gender TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_learners_school ON public.learners(school_id);

CREATE TABLE public.parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, learner_id)
);
CREATE INDEX idx_parent_links_parent ON public.parent_links(parent_user_id);
CREATE INDEX idx_parent_links_learner ON public.parent_links(learner_id);

CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_number TEXT,
  position TEXT,
  subjects_taught TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_id INT NOT NULL REFERENCES public.grades(id),
  teacher_user_id UUID REFERENCES auth.users(id),
  academic_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  UNIQUE(class_id, learner_id)
);

-- =========== ACADEMIC ===========
CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  assessment_name TEXT NOT NULL,
  term INT NOT NULL CHECK (term BETWEEN 1 AND 4),
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  class_average NUMERIC(5,2),
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_marks_learner ON public.marks(learner_id);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(learner_id, date)
);
CREATE INDEX idx_attendance_learner ON public.attendance(learner_id);

CREATE TABLE public.discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  type discipline_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  points INT DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_discipline_learner ON public.discipline_records(learner_id);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_school ON public.calendar_events(school_id);

CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  from_school_id UUID NOT NULL REFERENCES public.schools(id),
  to_school_id UUID NOT NULL REFERENCES public.schools(id),
  reason TEXT,
  status transfer_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  school_id UUID REFERENCES public.schools(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_school ON public.audit_log(school_id);

-- =========== SECURITY DEFINER HELPERS ===========
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_school_role(_user_id UUID, _school_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(_user_id UUID, _learner_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_links WHERE parent_user_id = _user_id AND learner_id = _learner_id);
$$;

CREATE OR REPLACE FUNCTION public.user_school_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT school_id FROM public.user_roles WHERE user_id = _user_id AND school_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.learner_school_id(_learner_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.learners WHERE id = _learner_id;
$$;

-- =========== PROFILE TRIGGER ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  -- default role = parent
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== ENABLE RLS ===========
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =========== RLS POLICIES ===========
-- Public read for reference data
CREATE POLICY "Anyone can view schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Anyone can view grades" ON public.grades FOR SELECT USING (true);
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT USING (true);

CREATE POLICY "School admins can update schools" ON public.schools FOR UPDATE USING (
  public.has_school_role(auth.uid(), id, ARRAY['principal','school_admin']::app_role[])
);

-- Profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "School admins view school roles" ON public.user_roles FOR SELECT USING (
  school_id IS NOT NULL AND public.has_school_role(auth.uid(), school_id, ARRAY['principal','school_admin']::app_role[])
);

-- Learners
CREATE POLICY "Parents view their children" ON public.learners FOR SELECT USING (
  public.is_parent_of(auth.uid(), id)
);
CREATE POLICY "School staff view school learners" ON public.learners FOR SELECT USING (
  public.has_school_role(auth.uid(), school_id, ARRAY['teacher','principal','school_admin']::app_role[])
);
CREATE POLICY "School admins manage learners" ON public.learners FOR ALL USING (
  public.has_school_role(auth.uid(), school_id, ARRAY['principal','school_admin']::app_role[])
);

-- Parent links
CREATE POLICY "Parents view own links" ON public.parent_links FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "School admins view school parent links" ON public.parent_links FOR SELECT USING (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['principal','school_admin']::app_role[])
);

-- Staff
CREATE POLICY "Staff view own record" ON public.staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "School admins manage staff" ON public.staff FOR ALL USING (
  public.has_school_role(auth.uid(), school_id, ARRAY['principal','school_admin']::app_role[])
);

-- Classes & enrollments
CREATE POLICY "School staff view classes" ON public.classes FOR SELECT USING (
  public.has_school_role(auth.uid(), school_id, ARRAY['teacher','principal','school_admin']::app_role[])
);
CREATE POLICY "School admins manage classes" ON public.classes FOR ALL USING (
  public.has_school_role(auth.uid(), school_id, ARRAY['principal','school_admin']::app_role[])
);
CREATE POLICY "School staff view enrollments" ON public.class_enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND public.has_school_role(auth.uid(), c.school_id, ARRAY['teacher','principal','school_admin']::app_role[]))
);

-- Marks
CREATE POLICY "Parents view child marks" ON public.marks FOR SELECT USING (public.is_parent_of(auth.uid(), learner_id));
CREATE POLICY "Staff view school marks" ON public.marks FOR SELECT USING (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['teacher','principal','school_admin']::app_role[])
);
CREATE POLICY "Staff insert marks" ON public.marks FOR INSERT WITH CHECK (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['teacher','principal','school_admin']::app_role[])
);
CREATE POLICY "Staff update marks" ON public.marks FOR UPDATE USING (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['teacher','principal','school_admin']::app_role[])
);

-- Attendance
CREATE POLICY "Parents view child attendance" ON public.attendance FOR SELECT USING (public.is_parent_of(auth.uid(), learner_id));
CREATE POLICY "Staff manage attendance" ON public.attendance FOR ALL USING (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['teacher','principal','school_admin']::app_role[])
);

-- Discipline
CREATE POLICY "Parents view child discipline" ON public.discipline_records FOR SELECT USING (public.is_parent_of(auth.uid(), learner_id));
CREATE POLICY "Staff manage discipline" ON public.discipline_records FOR ALL USING (
  public.has_school_role(auth.uid(), public.learner_school_id(learner_id), ARRAY['teacher','principal','school_admin']::app_role[])
);

-- Calendar
CREATE POLICY "Anyone view school calendar" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Staff manage calendar" ON public.calendar_events FOR ALL USING (
  school_id IS NOT NULL AND public.has_school_role(auth.uid(), school_id, ARRAY['teacher','principal','school_admin']::app_role[])
);

-- Transfers
CREATE POLICY "Parents view child transfers" ON public.transfers FOR SELECT USING (public.is_parent_of(auth.uid(), learner_id));
CREATE POLICY "School staff view transfers" ON public.transfers FOR SELECT USING (
  public.has_school_role(auth.uid(), from_school_id, ARRAY['principal','school_admin']::app_role[])
  OR public.has_school_role(auth.uid(), to_school_id, ARRAY['principal','school_admin']::app_role[])
);
CREATE POLICY "Admins manage transfers" ON public.transfers FOR ALL USING (
  public.has_school_role(auth.uid(), from_school_id, ARRAY['principal','school_admin']::app_role[])
  OR public.has_school_role(auth.uid(), to_school_id, ARRAY['principal','school_admin']::app_role[])
);

-- Notifications
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Audit log
CREATE POLICY "School admins view audit" ON public.audit_log FOR SELECT USING (
  school_id IS NOT NULL AND public.has_school_role(auth.uid(), school_id, ARRAY['principal','school_admin']::app_role[])
);
