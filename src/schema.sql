-- ==============================================================================
-- FRC SCOUTING DASHBOARD TEMPLATE - DATABASE INITIALIZATION SCRIPT
-- ==============================================================================

-- 1. PROFILES TABLE (User Roles & Permissions)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    role text DEFAULT 'scouter'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. API KEYS TABLE (Global Configs & Event Settings)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    key_value text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Config Keys (Teams will update these in the app or dashboard)
INSERT INTO public.api_keys (name, key_value) VALUES 
    ('teamCode', 'YOUR_SECRET_TEAM_CODE_HERE'), 
    ('active_event', '2026default'), 
    ('tba', 'YOUR_THE_BLUE_ALLIANCE_API_KEY_HERE')
ON CONFLICT (name) DO NOTHING;

-- 3. SCOUT ASSIGNMENTS TABLE (Pending/Completed Team Assignments)
CREATE TABLE IF NOT EXISTS public.scout_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scouter_email text NOT NULL,
    team_number integer NOT NULL,
    event_key text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PIT SCOUTING TABLE (The core 6-section payload)
CREATE TABLE IF NOT EXISTS public.pit_scouting (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_number integer NOT NULL,
    event_key text NOT NULL,
    team_nickname text,
    scouter_initials text,
    drivetrain text,
    drive_motor text,
    terrain_nav text,
    intake_loc text,
    fuel_capacity integer DEFAULT 0,
    scoring_method text,
    auton_start text,
    auton_fuel integer DEFAULT 0,
    auton_climb text,
    max_climb text,
    climb_speed text,
    proud_features text,
    strategic_pitch text,
    vulnerabilities text,
    scouter_name text,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- SYSTEM TRIGGERS: AUTOMATIC PROFILE GENERATION
-- (Ensures a profile row is created the exact second someone signs up)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'scouter');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKET: PHOTOS & LOVAT CLOUD SYNC
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('scouting-data', 'scouting-data', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- SECURITY POLICIES (Row Level Security)
-- Sets up standard CRUD access for authenticated users
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pit_scouting ENABLE ROW LEVEL SECURITY;

-- Create blanket policies allowing logged-in (authenticated) users to interact with tables
CREATE POLICY "Allow authenticated full access to profiles" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to api_keys" ON public.api_keys FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to scout_assignments" ON public.scout_assignments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to pit_scouting" ON public.pit_scouting FOR ALL TO authenticated USING (true);

-- Allow public read access for alliance partner dashboards
CREATE POLICY "Allow public read access to api_keys" ON public.api_keys FOR SELECT USING (true);
CREATE POLICY "Allow public read access to scout_assignments" ON public.scout_assignments FOR SELECT USING (true);
CREATE POLICY "Allow public read access to pit_scouting" ON public.pit_scouting FOR SELECT USING (true);

-- Storage Policies
CREATE POLICY "Allow public viewing of scouting data" ON storage.objects FOR SELECT TO public USING (bucket_id = 'scouting-data');
CREATE POLICY "Allow authenticated uploads to scouting data" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'scouting-data');
CREATE POLICY "Allow authenticated updates to scouting data" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'scouting-data');

-- 5. USER SESSIONS (Telemetry Dashboard)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    session_id uuid PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE,
    user_name text NOT NULL,
    current_view text NOT NULL,
    start_time timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_heartbeat timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status text DEFAULT 'online'::text NOT NULL
);

-- 6. PARTNER TOKENS (Secure Alliance Sharing)
CREATE TABLE IF NOT EXISTS public.partner_tokens (
    token_string text PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);

-- Enable Supabase Realtime for user_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;

-- RLS policies for user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only insert/update their own uid" ON public.user_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Only users with the 'Admin' role can select/read" ON public.user_sessions FOR SELECT TO authenticated USING (
    (SELECT role FROM public.profiles WHERE profiles.id = auth.uid()) IN ('admin', 'owner')
);

-- RLS policies for partner_tokens
ALTER TABLE public.partner_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to partner_tokens" ON public.partner_tokens FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert to partner_tokens" ON public.partner_tokens FOR INSERT TO authenticated WITH CHECK (true);