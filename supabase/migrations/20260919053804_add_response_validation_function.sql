-- Server-side validation for patient response submission.
-- The browser is untrusted: a crafted request can bypass the UI and submit
-- a response to a completed task, a non-existent task, or with a value that
-- doesn't match the task type. This function checks all of that atomically
-- inside the database before inserting.

-- Timestamp convention:
-- All timestamp columns use `timestamptz NOT NULL DEFAULT now()`.
--   - `created_at` on tasks: when the doctor created the task.
--   - `due_at` on tasks: when the patient should complete it (set by client).
--   - `submitted_at` on responses: when the patient submitted the response (server-set).
--   - `created_at` on alerts: when the alert was generated (server-set).
--   - `occurred_at` on timeline_events: when the event was recorded (server-set).
-- The application never sets server timestamps; they default to now() on insert.

CREATE OR REPLACE FUNCTION submit_patient_response(
  p_task_id uuid,
  p_medication_taken boolean,
  p_temperature_f numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task record;
  v_response_id uuid;
  v_alert_id uuid;
  v_alert_type text;
  v_alert_title text;
  v_alert_description text;
  v_response_description text;
  v_timeline_id uuid;
  v_alert_timeline_id uuid;
BEGIN
  -- 1. Fetch the task and validate it exists, is pending, and type matches the payload
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_task.status != 'pending' THEN
    RAISE EXCEPTION 'This task already has a saved response.' USING ERRCODE = 'P0003';
  END IF;

  -- 2. Validate the response value matches the task type
  IF v_task.task_type = 'medication' THEN
    IF p_medication_taken IS NULL OR p_temperature_f IS NOT NULL THEN
      RAISE EXCEPTION 'Medication tasks require a taken/not-taken answer, not a temperature.' USING ERRCODE = 'P0004';
    END IF;
  ELSIF v_task.task_type = 'temperature' THEN
    IF p_temperature_f IS NULL OR p_medication_taken IS NOT NULL THEN
      RAISE EXCEPTION 'Temperature tasks require a numeric reading, not a medication answer.' USING ERRCODE = 'P0004';
    END IF;
    IF p_temperature_f < 80 OR p_temperature_f > 120 THEN
      RAISE EXCEPTION 'Temperature must be between 80 and 120 degrees Fahrenheit.' USING ERRCODE = 'P0005';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown task type.' USING ERRCODE = 'P0006';
  END IF;

  -- 3. Insert the response (unique constraint catches duplicates)
  INSERT INTO public.responses (task_id, patient_id, medication_taken, temperature_f)
  VALUES (p_task_id, v_task.patient_id, p_medication_taken, p_temperature_f)
  RETURNING id INTO v_response_id;

  -- 4. Mark the task as completed
  UPDATE public.tasks SET status = 'completed' WHERE id = p_task_id;

  -- 5. Generate an alert if the response warrants one
  v_alert_type := NULL;
  IF v_task.task_type = 'medication' AND p_medication_taken = false THEN
    v_alert_type := 'medication_not_taken';
    v_alert_title := 'Medication not taken';
    v_alert_description := v_task.title || ' was marked as not taken.';
  ELSIF v_task.task_type = 'temperature' AND p_temperature_f > 101.0 THEN
    v_alert_type := 'high_temperature';
    v_alert_title := 'High temperature';
    v_alert_description := 'A temperature of ' || p_temperature_f || ' degrees F was recorded.';
  END IF;

  IF v_alert_type IS NOT NULL THEN
    INSERT INTO public.alerts (response_id, patient_id, alert_type, title, description)
    VALUES (v_response_id, v_task.patient_id, v_alert_type, v_alert_title, v_alert_description)
    RETURNING id INTO v_alert_id;
  END IF;

  -- 6. Insert timeline event for the response
  IF v_task.task_type = 'medication' THEN
    v_response_description := v_task.title || ' was marked ' || CASE WHEN p_medication_taken THEN 'taken' ELSE 'not taken' END || '.';
  ELSE
    v_response_description := 'Temperature recorded at ' || p_temperature_f || ' degrees F.';
  END IF;

  INSERT INTO public.timeline_events (patient_id, event_type, title, description, task_id, response_id)
  VALUES (v_task.patient_id, 'response_submitted', 'Patient response received', v_response_description, p_task_id, v_response_id)
  RETURNING id INTO v_timeline_id;

  -- 7. Insert timeline event for the alert if one was created
  IF v_alert_id IS NOT NULL THEN
    INSERT INTO public.timeline_events (patient_id, event_type, title, description, response_id, alert_id)
    VALUES (v_task.patient_id, 'alert_generated', v_alert_title, v_alert_description, v_response_id, v_alert_id)
    RETURNING id INTO v_alert_timeline_id;
  END IF;

  -- 8. Return the created records so the client can update state
  RETURN jsonb_build_object(
    'response_id', v_response_id,
    'alert_id', v_alert_id,
    'timeline_id', v_timeline_id,
    'alert_timeline_id', v_alert_timeline_id,
    'alert_type', v_alert_type,
    'alert_title', v_alert_title,
    'alert_description', v_alert_description,
    'response_description', v_response_description,
    'patient_id', v_task.patient_id,
    'task_id', p_task_id
  );
END;
$$;

-- The function is callable by anon and authenticated since this app has no sign-in screen
-- and the shared workspace is intentionally public.
REVOKE EXECUTE ON FUNCTION submit_patient_response FROM anon;
GRANT EXECUTE ON FUNCTION submit_patient_response TO anon, authenticated;

-- Add a comment documenting the timestamp convention on the schema
COMMENT ON COLUMN public.responses.submitted_at IS 'Server-set timestamp (DEFAULT now()) — when the patient submitted the response. Never set by the client.';
COMMENT ON COLUMN public.tasks.created_at IS 'Server-set timestamp (DEFAULT now()) — when the doctor created the task. Never set by the client.';
COMMENT ON COLUMN public.alerts.created_at IS 'Server-set timestamp (DEFAULT now()) — when the alert was generated by the system. Never set by the client.';
COMMENT ON COLUMN public.timeline_events.occurred_at IS 'Server-set timestamp (DEFAULT now()) — when the event was recorded. Never set by the client.';
COMMENT ON COLUMN public.tasks.due_at IS 'Client-set timestamp — when the patient should complete the task. Stored as timestamptz.';
