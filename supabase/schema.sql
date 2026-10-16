-- ==============================================================================
-- MEGABYTE SYSTEM (مگابایت سیستم) - Production Database Schema & Security (RLS)
-- Employee Activity & Performance Management System
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('employee', 'manager', 'ceo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('active', 'paused', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blocker_severity AS ENUM ('low', 'medium', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE review_status AS ENUM ('pending', 'approved', 'needs_revision');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    department TEXT DEFAULT 'فنی و توسعه',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Work Logs Table (ثبت فعالیت کارمندان)
CREATE TABLE IF NOT EXISTS public.work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    summary TEXT NOT NULL,
    sub_tasks JSONB DEFAULT '[]'::jsonb,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    has_blocker BOOLEAN DEFAULT false,
    blocker_category TEXT,
    blocker_severity blocker_severity DEFAULT 'low',
    blocker_description TEXT,
    blocker_resolved BOOLEAN DEFAULT false,
    manager_status review_status DEFAULT 'pending',
    manager_feedback TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Assigned Tasks Table (تسک‌های محول شده)
CREATE TABLE IF NOT EXISTS public.assigned_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    priority blocker_severity DEFAULT 'medium',
    due_date DATE,
    status task_status DEFAULT 'todo',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Announcements Table (اطلاعیه‌های شرکت)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON public.work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_project_id ON public.work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_work_date ON public.work_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_work_logs_manager_status ON public.work_logs(manager_status);
CREATE INDEX IF NOT EXISTS idx_work_logs_blocker ON public.work_logs(has_blocker, blocker_resolved);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_assigned_to ON public.assigned_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON public.assigned_tasks(status);

-- 5. SECURITY DEFINER HELPER FUNCTIONS

-- Function to get current user role without causing RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to check if user is CEO
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (role = 'ceo') FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to check if user is Manager or CEO
CREATE OR REPLACE FUNCTION public.is_manager_or_ceo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (role IN ('manager', 'ceo')) FROM public.profiles WHERE id = auth.uid();
$$;

-- 6. AUTOMATIC PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
    initial_role user_role;
    user_full_name TEXT;
    user_dept TEXT;
BEGIN
    -- Check if this is the first user in the database
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    IF user_count = 0 THEN
        initial_role := 'ceo'; -- First registered user is automatically CEO
    ELSE
        initial_role := 'employee'; -- All subsequent users default to employee
    END IF;

    -- Extract full_name and department from metadata if provided
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_dept := COALESCE(NEW.raw_user_meta_data->>'department', 'فنی و توسعه');

    INSERT INTO public.profiles (id, email, full_name, role, department, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        initial_role,
        user_dept,
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------
-- Authenticated users can view all colleague profiles (needed for task assignment and directory)
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own full_name and department
CREATE POLICY "profiles_update_self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND (
            -- Employee cannot elevate their own role or deactivate themselves
            (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
             AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
            OR public.is_ceo()
        )
    );

-- Only CEO can update any user's role or active status
CREATE POLICY "profiles_update_ceo"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_ceo())
    WITH CHECK (public.is_ceo());

-- ----------------------------------------------------
-- PROJECTS POLICIES
-- ----------------------------------------------------
-- All authenticated users can view projects
CREATE POLICY "projects_select_authenticated"
    ON public.projects FOR SELECT
    TO authenticated
    USING (true);

-- Managers and CEOs can create projects
CREATE POLICY "projects_insert_manager_ceo"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (public.is_manager_or_ceo());

-- Managers and CEOs can update projects
CREATE POLICY "projects_update_manager_ceo"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (public.is_manager_or_ceo())
    WITH CHECK (public.is_manager_or_ceo());

-- Only CEO can delete projects
CREATE POLICY "projects_delete_ceo"
    ON public.projects FOR DELETE
    TO authenticated
    USING (public.is_ceo());

-- ----------------------------------------------------
-- WORK LOGS POLICIES
-- ----------------------------------------------------
-- Employees can view only their own logs; Managers and CEOs can view all logs
CREATE POLICY "work_logs_select"
    ON public.work_logs FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR public.is_manager_or_ceo()
    );

-- Authenticated users can insert logs for themselves
CREATE POLICY "work_logs_insert"
    ON public.work_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- Employees can update their own logs only if pending or needs_revision
CREATE POLICY "work_logs_update_employee"
    ON public.work_logs FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() 
        AND manager_status IN ('pending', 'needs_revision')
    )
    WITH CHECK (
        user_id = auth.uid() 
        AND manager_status IN ('pending', 'needs_revision')
    );

-- Managers and CEOs can update review status, feedback, and blocker resolution
CREATE POLICY "work_logs_update_manager_ceo"
    ON public.work_logs FOR UPDATE
    TO authenticated
    USING (public.is_manager_or_ceo())
    WITH CHECK (public.is_manager_or_ceo());

-- Employees can delete their own pending logs; CEOs can delete any log
CREATE POLICY "work_logs_delete"
    ON public.work_logs FOR DELETE
    TO authenticated
    USING (
        (user_id = auth.uid() AND manager_status = 'pending')
        OR public.is_ceo()
    );

-- ----------------------------------------------------
-- ASSIGNED TASKS POLICIES
-- ----------------------------------------------------
-- Employees see tasks assigned to them; Managers and CEOs see all tasks
CREATE POLICY "assigned_tasks_select"
    ON public.assigned_tasks FOR SELECT
    TO authenticated
    USING (
        assigned_to = auth.uid()
        OR public.is_manager_or_ceo()
    );

-- Managers and CEOs can insert tasks
CREATE POLICY "assigned_tasks_insert_manager_ceo"
    ON public.assigned_tasks FOR INSERT
    TO authenticated
    WITH CHECK (public.is_manager_or_ceo());

-- Employees can update the status of their assigned tasks; Managers/CEOs can update any task field
CREATE POLICY "assigned_tasks_update_employee"
    ON public.assigned_tasks FOR UPDATE
    TO authenticated
    USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "assigned_tasks_update_manager_ceo"
    ON public.assigned_tasks FOR UPDATE
    TO authenticated
    USING (public.is_manager_or_ceo())
    WITH CHECK (public.is_manager_or_ceo());

-- Managers and CEOs can delete tasks
CREATE POLICY "assigned_tasks_delete_manager_ceo"
    ON public.assigned_tasks FOR DELETE
    TO authenticated
    USING (public.is_manager_or_ceo());

-- ----------------------------------------------------
-- ANNOUNCEMENTS POLICIES
-- ----------------------------------------------------
-- All authenticated users can view announcements
CREATE POLICY "announcements_select_authenticated"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (true);

-- Managers and CEOs can create announcements
CREATE POLICY "announcements_insert_manager_ceo"
    ON public.announcements FOR INSERT
    TO authenticated
    WITH CHECK (public.is_manager_or_ceo());

-- Managers and CEOs can delete announcements
CREATE POLICY "announcements_delete_manager_ceo"
    ON public.announcements FOR DELETE
    TO authenticated
    USING (public.is_manager_or_ceo());

-- 8. INITIAL SEED DATA (Creates default company projects if none exist)
INSERT INTO public.projects (name, description, status, progress)
VALUES 
    ('توسعه پلتفرم ابری مگابایت', 'سامانه ابری مدیریت یکپارچه و پردازش توزیع‌شده داده‌ها', 'active', 45),
    ('اتوماسیون اداری و منابع انسانی', 'سامانه ثبت درخواست‌های اداری، حضور و غیاب و گزارش کار', 'active', 70),
    ('پروژه امنیت و تست نفوذ زیرساخت', 'ارتقای امنیت شبکه، استانداردسازی فایروال و ممیزی دسترسی‌ها', 'active', 25)
ON CONFLICT DO NOTHING;
