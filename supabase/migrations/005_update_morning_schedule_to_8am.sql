-- Migration: Update Morning Session Schedule to 8:00 AM WAT
-- Updates all existing morning session slots to 08:00:00 scheduled_time and name 'Morning Session (8:00 AM)'

UPDATE session_slots
SET 
  scheduled_time = '08:00:00'::TIME,
  name = 'Morning Session (8:00 AM)'
WHERE session_code = 'morning';

-- Update the generate_programme_days trigger function default as well
CREATE OR REPLACE FUNCTION generate_programme_days()
RETURNS TRIGGER AS $$
DECLARE
    curr_date DATE := NEW.start_date;
    day_id UUID;
    i INT;
BEGIN
    FOR i IN 1..NEW.duration_days LOOP
        INSERT INTO programme_days (programme_id, day_number, calendar_date, theme, is_active)
        VALUES (
            NEW.id,
            i,
            curr_date,
            'Day ' || i || ' Engagement & Outreach',
            CASE WHEN i = 1 THEN TRUE ELSE FALSE END
        )
        RETURNING id INTO day_id;

        -- 1. Morning Session (8:00 AM WAT, 08:00 AM - 10:00 AM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        ) VALUES (
            day_id,
            'morning',
            'Morning Session (8:00 AM)',
            '08:00:00'::TIME,
            0,
            120
        );

        -- 2. Afternoon Session (3:00 PM WAT, 03:00 PM - 05:00 PM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        ) VALUES (
            day_id,
            'afternoon',
            'Afternoon Session (3:00 PM)',
            '15:00:00'::TIME,
            0,
            120
        );

        -- 3. Evening Session (7:00 PM WAT, 07:00 PM - 09:00 PM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        ) VALUES (
            day_id,
            'evening',
            'Evening Session (7:00 PM)',
            '19:00:00'::TIME,
            0,
            120
        );

        curr_date := curr_date + INTERVAL '1 day';
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
