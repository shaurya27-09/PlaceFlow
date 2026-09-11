-- ==============================================================================
-- PlaceFlow TPC Platform - Supabase PostgreSQL Database Schema
-- Run this complete script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enrollment_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    branch TEXT NOT NULL CHECK (branch IN ('CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil')),
    cgpa NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    backlogs INTEGER NOT NULL DEFAULT 0,
    attendance INTEGER NOT NULL DEFAULT 100,
    placement_status TEXT NOT NULL DEFAULT 'Unplaced' CHECK (placement_status IN ('Unplaced', 'Placed', 'Dream Placed', 'Higher Studies', 'Opted Out')),
    offers JSONB DEFAULT '[]'::jsonb,
    graduation_year INTEGER NOT NULL DEFAULT 2026,
    skills JSONB DEFAULT '[]'::jsonb,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    resume_url TEXT,
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for student searches and branch queries
CREATE INDEX IF NOT EXISTS idx_students_branch ON public.students(branch);
CREATE INDEX IF NOT EXISTS idx_students_cgpa ON public.students(cgpa);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(placement_status);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON public.students(enrollment_number);

-- 3. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('Mass', 'Core', 'Dream', 'Super Dream')),
    open_drives_count INTEGER DEFAULT 0,
    average_package NUMERIC(5, 2) DEFAULT 0.00,
    min_package NUMERIC(5, 2) DEFAULT 0.00,
    max_package NUMERIC(5, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Upcoming', 'Past Partner')),
    website TEXT,
    location TEXT,
    contact_person TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    total_hired_history INTEGER DEFAULT 0,
    logo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_tier ON public.companies(tier);

-- 4. Placement Drives Table
CREATE TABLE IF NOT EXISTS public.placement_drives (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    job_description TEXT,
    package_lpa NUMERIC(5, 2) NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('Mass', 'Core', 'Dream', 'Super Dream')),
    min_cgpa NUMERIC(4, 2) NOT NULL DEFAULT 6.00,
    max_backlogs INTEGER NOT NULL DEFAULT 0,
    eligible_branches JSONB NOT NULL DEFAULT '["CSE", "IT", "ECE"]'::jsonb,
    min_attendance INTEGER NOT NULL DEFAULT 75,
    graduation_year INTEGER NOT NULL DEFAULT 2026,
    offer_policy_rule TEXT NOT NULL DEFAULT 'Dream Upgrade Only (>= 1.5x)',
    drive_date DATE NOT NULL,
    registration_deadline DATE NOT NULL,
    location TEXT DEFAULT 'On-Campus' CHECK (location IN ('On-Campus', 'Virtual', 'Hybrid')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Ongoing', 'Upcoming', 'Completed', 'Cancelled')),
    rounds JSONB DEFAULT '["Online Assessment", "Technical Interview", "HR Interview"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drives_status ON public.placement_drives(status);
CREATE INDEX IF NOT EXISTS idx_drives_date ON public.placement_drives(drive_date);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS public.applications (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_enrollment TEXT NOT NULL,
    student_branch TEXT NOT NULL,
    student_cgpa NUMERIC(4, 2) NOT NULL,
    student_attendance INTEGER NOT NULL,
    drive_id TEXT NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    package_lpa NUMERIC(5, 2) NOT NULL,
    applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
    eligibility_status TEXT NOT NULL DEFAULT 'Eligible' CHECK (eligibility_status IN ('Eligible', 'Conditionally Eligible', 'Ineligible')),
    ineligibility_reasons JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Applied' CHECK (status IN ('Applied', 'Shortlisted', 'Interview', 'Offered', 'Selected', 'Rejected', 'Offer Accepted', 'Offer Declined')),
    current_round TEXT,
    interview_slot TEXT,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_student ON public.applications(student_id);
CREATE INDEX IF NOT EXISTS idx_apps_drive ON public.applications(drive_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON public.applications(status);

-- 6. Offers Table
CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_enrollment TEXT NOT NULL,
    student_branch TEXT NOT NULL,
    company_id TEXT,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    package_lpa NUMERIC(5, 2) NOT NULL,
    offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Accepted', 'Pending', 'Declined', 'Revoked', 'Blocked by Policy')),
    policy_check_passed BOOLEAN NOT NULL DEFAULT true,
    policy_violation_reason TEXT,
    tier TEXT NOT NULL DEFAULT 'Core' CHECK (tier IN ('Mass', 'Core', 'Dream', 'Super Dream')),
    deadline_date DATE NOT NULL,
    bond_years INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_student ON public.offers(student_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(status);

-- 7. Institutional Placement Offer Policy Table
CREATE TABLE IF NOT EXISTS public.offer_policy (
    id TEXT PRIMARY KEY DEFAULT 'default-policy',
    allow_multiple_offers BOOLEAN NOT NULL DEFAULT true,
    max_offers_allowed INTEGER NOT NULL DEFAULT 2,
    dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    super_dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 14.00,
    min_hike_percentage_for_upgrade NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    freeze_on_acceptance BOOLEAN NOT NULL DEFAULT true,
    mass_recruiter_lock BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default offer policy if not present
INSERT INTO public.offer_policy (
    id,
    allow_multiple_offers,
    max_offers_allowed,
    dream_threshold_lpa,
    super_dream_threshold_lpa,
    min_hike_percentage_for_upgrade,
    freeze_on_acceptance,
    mass_recruiter_lock
) VALUES (
    'default-policy',
    true,
    2,
    8.00,
    14.00,
    50.00,
    true,
    true
) ON CONFLICT (id) DO NOTHING;

-- 7b. Offer Policy Configuration (offer_policy_config) Compatibility Table
CREATE TABLE IF NOT EXISTS public.offer_policy_config (
    id TEXT PRIMARY KEY DEFAULT 'default-policy',
    allow_multiple_offers BOOLEAN NOT NULL DEFAULT true,
    max_offers_allowed INTEGER NOT NULL DEFAULT 2,
    dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    super_dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 14.00,
    min_hike_percentage_for_upgrade NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    freeze_on_acceptance BOOLEAN NOT NULL DEFAULT true,
    mass_recruiter_lock BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.offer_policy_config (
    id,
    allow_multiple_offers,
    max_offers_allowed,
    dream_threshold_lpa,
    super_dream_threshold_lpa,
    min_hike_percentage_for_upgrade,
    freeze_on_acceptance,
    mass_recruiter_lock
) VALUES (
    'default-policy',
    true,
    2,
    8.00,
    14.00,
    50.00,
    true,
    true
) ON CONFLICT (id) DO NOTHING;

-- 8. User Profiles Table (Maps Supabase Auth UUID to Student or Recruiter Company)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student', 'recruiter')),
    student_id TEXT,
    company_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Row Level Security (RLS) Configuration
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_policy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read and write access for authenticated & anon clients in PlaceFlow
DROP POLICY IF EXISTS "Public access to students" ON public.students;
CREATE POLICY "Public access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to companies" ON public.companies;
CREATE POLICY "Public access to companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to drives" ON public.placement_drives;
CREATE POLICY "Public access to drives" ON public.placement_drives FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to applications" ON public.applications;
CREATE POLICY "Public access to applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to offers" ON public.offers;
CREATE POLICY "Public access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to offer_policy" ON public.offer_policy;
CREATE POLICY "Public access to offer_policy" ON public.offer_policy FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to offer_policy_config" ON public.offer_policy_config;
CREATE POLICY "Public access to offer_policy_config" ON public.offer_policy_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to profiles" ON public.profiles;
CREATE POLICY "Public access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 10. Analytics View for NIRF & Real-time KPIs
CREATE OR REPLACE VIEW public.nirf_placement_summary AS
SELECT
    s.branch,
    COUNT(s.id) AS total_enrolled,
    COUNT(CASE WHEN s.placement_status IN ('Placed', 'Dream Placed') THEN 1 END) AS total_placed,
    ROUND(
        (COUNT(CASE WHEN s.placement_status IN ('Placed', 'Dream Placed') THEN 1 END)::NUMERIC / NULLIF(COUNT(s.id), 0)) * 100,
        2
    ) AS placement_percentage,
    ROUND(AVG(o.package_lpa), 2) AS avg_package_lpa,
    MAX(o.package_lpa) AS highest_package_lpa
FROM public.students s
LEFT JOIN public.offers o ON s.id = o.student_id AND o.status = 'Accepted'
GROUP BY s.branch;

-- Confirmation Note
COMMENT ON TABLE public.students IS 'PlaceFlow candidate cohort and academic profiles';
COMMENT ON TABLE public.placement_drives IS 'Institutional recruitment drives and eligibility criteria';
