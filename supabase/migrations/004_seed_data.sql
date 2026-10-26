-- Migration: 004_seed_data.sql
-- Description: Initial seed data for LinkedIn Local Owerri 30-day Programme

DO $$
DECLARE
    v_prog_id UUID;
    v_day_1_id UUID;
    v_morning_slot_id UUID;
    v_afternoon_slot_id UUID;
    v_evening_slot_id UUID;
BEGIN
    -- 1. Create or retrieve active programme
    INSERT INTO programmes (
        title,
        slug,
        description,
        start_date,
        duration_days,
        timezone,
        status
    )
    VALUES (
        'LinkedIn Local Owerri 30-Day Volunteer Programme',
        'llo-30day-2026',
        'Official 30-day engagement programme tracking volunteer contributions across morning, afternoon, and evening sessions.',
        CURRENT_DATE,
        30,
        'Africa/Lagos',
        'active'
    )
    ON CONFLICT (slug) DO UPDATE
    SET status = 'active'
    RETURNING id INTO v_prog_id;

    -- 2. Generate the 30 days and 90 session slots
    PERFORM generate_programme_calendar(v_prog_id);

    -- 3. Retrieve Day 1 session slots
    SELECT id INTO v_day_1_id FROM programme_days WHERE programme_id = v_prog_id AND day_number = 1;

    SELECT id INTO v_morning_slot_id FROM session_slots WHERE programme_day_id = v_day_1_id AND session_code = 'morning';
    SELECT id INTO v_afternoon_slot_id FROM session_slots WHERE programme_day_id = v_day_1_id AND session_code = 'afternoon';
    SELECT id INTO v_evening_slot_id FROM session_slots WHERE programme_day_id = v_day_1_id AND session_code = 'evening';

    -- 4. Seed sample tasks for Day 1
    -- Morning tasks
    IF v_morning_slot_id IS NOT NULL THEN
        INSERT INTO session_tasks (session_slot_id, title, description, category, status)
        VALUES 
            (v_morning_slot_id, 'Social Media Blast & Morning Amplification', 'Share and amplify official morning announcements on LinkedIn & Twitter.', 'Media & Publicity', 'open'),
            (v_morning_slot_id, 'Attendee Pre-registration Verification', 'Review incoming registration questions and provide onboarding support.', 'Registration', 'open'),
            (v_morning_slot_id, 'Morning Logistics & Venue Prep Call', 'Participate in the 15-minute logistics alignment check.', 'Logistics', 'open')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Afternoon tasks
    IF v_afternoon_slot_id IS NOT NULL THEN
        INSERT INTO session_tasks (session_slot_id, title, description, category, status)
        VALUES 
            (v_afternoon_slot_id, 'Speaker & Guest Coordinator Liaison', 'Confirm itinerary and media requirements with afternoon panel speakers.', 'Protocol', 'open'),
            (v_afternoon_slot_id, 'Community Question Moderation & Triage', 'Sort through participant inquiries and escalate key technical queries.', 'Technical', 'open'),
            (v_afternoon_slot_id, 'Sponsorship Content Verification', 'Review digital sponsor collaterals for social media posting schedule.', 'Media & Publicity', 'open')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Evening tasks
    IF v_evening_slot_id IS NOT NULL THEN
        INSERT INTO session_tasks (session_slot_id, title, description, category, status)
        VALUES 
            (v_evening_slot_id, 'Evening Daily Engagement Standup Report', 'Submit recap of daily tasks and flag any pending volunteer needs.', 'General', 'open'),
            (v_evening_slot_id, 'Post-Session Community Discussion Thread Moderation', 'Engage participants in the official evening community networking thread.', 'Media & Publicity', 'open')
        ON CONFLICT DO NOTHING;
    END IF;

    -- 5. Seed sample volunteers
    INSERT INTO volunteers (volunteer_id, full_name, email, phone, track, is_active, notes)
    VALUES
        ('LLO-VOL-001', 'Chinedu Okeke', 'chinedu.okeke@example.com', '+2348031234567', 'Logistics', true, 'Team Lead - Logistics'),
        ('LLO-VOL-002', 'Amina Yusuf', 'amina.yusuf@example.com', '+2348022345678', 'Media & Publicity', true, 'Content Creator'),
        ('LLO-VOL-003', 'Ngozi Eze', 'ngozi.eze@example.com', '+2348093456789', 'Protocol', true, 'VIP Liaison'),
        ('LLO-VOL-004', 'Emeka Nwosu', 'emeka.nwosu@example.com', '+2348144567890', 'Technical', true, 'AV & Stream Operator'),
        ('LLO-VOL-005', 'Fatima Bello', 'fatima.bello@example.com', '+2348185678901', 'Registration', true, 'Check-in Desk'),
        ('LLO-VOL-006', 'Kelechi Umeh', 'kelechi.umeh@example.com', '+2347066789012', 'General', true, 'Floater Volunteer')
    ON CONFLICT (volunteer_id) DO NOTHING;

END $$;
