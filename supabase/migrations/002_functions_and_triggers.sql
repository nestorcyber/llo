-- Migration: 002_functions_and_triggers.sql
-- Description: Business logic functions, triggers and calendar generator

-- Function to get current timestamp in Africa/Lagos timezone
CREATE OR REPLACE FUNCTION get_lagos_now()
RETURNS TIMESTAMP WITHOUT TIME ZONE
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Africa/Lagos')::timestamp;
$$;

-- Function to get current calendar date in Africa/Lagos timezone
CREATE OR REPLACE FUNCTION get_lagos_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Africa/Lagos')::date;
$$;

-- Function: generate_programme_calendar
-- Generates days (Day 1..duration_days) and 3 sessions per day for a programme
CREATE OR REPLACE FUNCTION generate_programme_calendar(p_programme_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_programme RECORD;
    v_day_idx INTEGER;
    v_day_date DATE;
    v_day_id UUID;
    v_days_created INTEGER := 0;
    v_sessions_created INTEGER := 0;
BEGIN
    SELECT * INTO v_programme FROM programmes WHERE id = p_programme_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Programme with ID % not found', p_programme_id;
    END IF;

    FOR v_day_idx IN 1..v_programme.duration_days LOOP
        v_day_date := v_programme.start_date + (v_day_idx - 1) * INTERVAL '1 day';

        -- Insert or retrieve programme day
        INSERT INTO programme_days (programme_id, day_number, calendar_date, theme)
        VALUES (
            p_programme_id,
            v_day_idx,
            v_day_date,
            'Day ' || v_day_idx || ' Engagement'
        )
        ON CONFLICT (programme_id, day_number) DO UPDATE
        SET calendar_date = EXCLUDED.calendar_date
        RETURNING id INTO v_day_id;

        v_days_created := v_days_created + 1;

        -- 1. Morning Session (10:00 AM)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'morning',
            'Morning Session (10:00 AM)',
            '10:00:00'::TIME,
            30,  -- opens at 09:30 AM
            120  -- closes at 12:00 PM
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        -- 2. Afternoon Session (3:00 PM)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'afternoon',
            'Afternoon Session (3:00 PM)',
            '15:00:00'::TIME,
            30,  -- opens at 02:30 PM
            120  -- closes at 05:00 PM
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        -- 3. Evening Session (8:00 PM)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'evening',
            'Evening Session (8:00 PM)',
            '20:00:00'::TIME,
            30,  -- opens at 07:30 PM
            120  -- closes at 10:00 PM
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        v_sessions_created := v_sessions_created + 3;
    END LOOP;

    RETURN jsonb_build_object(
        'programme_id', p_programme_id,
        'days_created', v_days_created,
        'sessions_created', v_sessions_created,
        'success', true
    );
END;
$$;

-- Trigger to protect the last active owner account from accidental removal or demotion
CREATE OR REPLACE FUNCTION trg_protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_count INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') OR 
       (TG_OP = 'UPDATE' AND (NEW.role != 'owner' OR NEW.is_active = false)) THEN
        
        -- Check if OLD record was an active owner
        IF OLD.role = 'owner' AND OLD.is_active = true THEN
            SELECT COUNT(*) INTO v_owner_count
            FROM staff_profiles
            WHERE role = 'owner' AND is_active = true AND id != OLD.id;

            IF v_owner_count < 1 THEN
                RAISE EXCEPTION 'Action rejected: At least one active Owner account must be preserved in the system.';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_last_owner_protection ON staff_profiles;
CREATE TRIGGER check_last_owner_protection
BEFORE UPDATE OR DELETE ON staff_profiles
FOR EACH ROW
EXECUTE FUNCTION trg_protect_last_owner();

-- Check session slot open status based on Africa/Lagos time
CREATE OR REPLACE FUNCTION is_session_slot_open(p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_slot RECORD;
    v_lagos_now TIMESTAMP;
    v_scheduled TIMESTAMP;
    v_open_time TIMESTAMP;
    v_close_time TIMESTAMP;
BEGIN
    SELECT 
        s.*, 
        d.calendar_date,
        p.status as programme_status
    INTO v_slot
    FROM session_slots s
    JOIN programme_days d ON s.programme_day_id = d.id
    JOIN programmes p ON d.programme_id = p.id
    WHERE s.id = p_slot_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Programme must be active
    IF v_slot.programme_status != 'active' THEN
        RETURN false;
    END IF;

    -- Manual override takes precedence
    IF v_slot.is_override_open IS NOT NULL THEN
        RETURN v_slot.is_override_open;
    END IF;

    v_lagos_now := get_lagos_now();
    v_scheduled := (v_slot.calendar_date || ' ' || v_slot.scheduled_time)::timestamp;
    v_open_time := v_scheduled - (v_slot.window_open_offset_minutes || ' minutes')::interval;
    v_close_time := v_scheduled + (v_slot.window_close_offset_minutes || ' minutes')::interval;

    RETURN (v_lagos_now >= v_open_time AND v_lagos_now <= v_close_time);
END;
$$;
