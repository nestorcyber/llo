-- Migration: 004_seed_data.sql
-- Description: Production seed data for LinkedIn Local Owerri 30-day Programme
-- Includes staff bootstrap in auth.users and staff_profiles

DO $$
DECLARE
    v_prog_id UUID;
    v_admin_id UUID := gen_random_uuid();
    v_manager_id UUID := gen_random_uuid();
    v_viewer_id UUID := gen_random_uuid();
BEGIN
    -- 1. Create or retrieve active programme
    INSERT INTO programmes (
        title,
        slug,
        description,
        start_date,
        duration_days,
        timezone,
        status,
        active_day_number
    )
    VALUES (
        'LinkedIn Local Owerri 30-Day Volunteer Programme',
        'llo-30day-2026',
        'Official 30-day engagement programme tracking volunteer contributions across morning, afternoon, and evening sessions.',
        CURRENT_DATE,
        30,
        'Africa/Lagos',
        'active',
        1
    )
    ON CONFLICT (slug) DO UPDATE
    SET status = 'active'
    RETURNING id INTO v_prog_id;

    -- 2. Generate the 30 days and 90 session slots
    PERFORM generate_programme_calendar(v_prog_id);

    -- 3. Bootstrap staff accounts in auth.users & staff_profiles
    -- Admin LLO (admin@llo.com / adminllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_admin_id,
            '00000000-0000-0000-0000-000000000000',
            'admin@llo.com',
            crypt('adminllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Admin LLO","role":"owner"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_admin_id, 'admin@llo.com', 'Admin LLO', 'owner', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Admin LLO', role = 'owner', is_active = true;
    END IF;

    -- Manager LLO (manager@llo.com / managerllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_manager_id,
            '00000000-0000-0000-0000-000000000000',
            'manager@llo.com',
            crypt('managerllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Manager LLO","role":"manager"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_manager_id, 'manager@llo.com', 'Manager LLO', 'manager', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Manager LLO', role = 'manager', is_active = true;
    END IF;

    -- Viewer LLO (viewer@llo.com / viewerllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'viewer@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_viewer_id,
            '00000000-0000-0000-0000-000000000000',
            'viewer@llo.com',
            crypt('viewerllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Viewer LLO","role":"viewer"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_viewer_id, 'viewer@llo.com', 'Viewer LLO', 'viewer', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Viewer LLO', role = 'viewer', is_active = true;
    END IF;

END $$;
