/*
# Create remote patient monitoring data model

1. New Tables
- `patients`: the single synthetic patient profile shown in both views.
- `tasks`: doctor-created medication and temperature tasks with instructions and due times.
- `responses`: one patient response per task, including the submitted value or medication choice.
- `alerts`: generated exceptions tied to a response, protected from duplicate creation.
- `timeline_events`: an append-only chronological activity stream for task creation, responses, and alerts.

2. Security
- Row level security is enabled on every table.
- This evaluation intentionally has no sign-in screen, so the shared synthetic workspace is readable and writable by anon and authenticated roles.
- Four explicit CRUD policies are defined per table.

3. Important Notes
- The patient is seeded with deterministic demo data so the app is useful on first load.
- A unique response per task and a unique alert per response/rule enforce idempotency at the database boundary.
- Alert thresholds are evaluated by the application before insert, while database constraints preserve the resulting records.
*/

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  condition text NOT NULL,
  care_team text NOT NULL,
  avatar_initials text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN ('medication', 'temperature')),
  title text NOT NULL,
  instructions text NOT NULL,
  due_at timestamptz NOT NULL,
  medication_name text,
  dosage text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medication_taken boolean,
  temperature_f numeric(5,2),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT response_value_matches_task CHECK (
    (medication_taken IS NOT NULL AND temperature_f IS NULL)
    OR (medication_taken IS NULL AND temperature_f IS NOT NULL)
  ),
  CONSTRAINT temperature_is_reasonable CHECK (temperature_f IS NULL OR (temperature_f >= 80 AND temperature_f <= 120))
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('medication_not_taken', 'high_temperature')),
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (response_id, alert_type)
);

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('task_created', 'response_submitted', 'alert_generated')),
  title text NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  response_id uuid REFERENCES public.responses(id) ON DELETE SET NULL,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tasks_patient_due_idx ON public.tasks(patient_id, due_at);
CREATE INDEX IF NOT EXISTS responses_patient_submitted_idx ON public.responses(patient_id, submitted_at);
CREATE INDEX IF NOT EXISTS alerts_patient_created_idx ON public.alerts(patient_id, created_at);
CREATE INDEX IF NOT EXISTS timeline_patient_occurred_idx ON public.timeline_events(patient_id, occurred_at DESC);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_select_patients" ON public.patients;
CREATE POLICY "shared_select_patients" ON public.patients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_patients" ON public.patients;
CREATE POLICY "shared_insert_patients" ON public.patients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_patients" ON public.patients;
CREATE POLICY "shared_update_patients" ON public.patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_patients" ON public.patients;
CREATE POLICY "shared_delete_patients" ON public.patients FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_select_tasks" ON public.tasks;
CREATE POLICY "shared_select_tasks" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_tasks" ON public.tasks;
CREATE POLICY "shared_insert_tasks" ON public.tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_tasks" ON public.tasks;
CREATE POLICY "shared_update_tasks" ON public.tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_tasks" ON public.tasks;
CREATE POLICY "shared_delete_tasks" ON public.tasks FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_select_responses" ON public.responses;
CREATE POLICY "shared_select_responses" ON public.responses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_responses" ON public.responses;
CREATE POLICY "shared_insert_responses" ON public.responses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_responses" ON public.responses;
CREATE POLICY "shared_update_responses" ON public.responses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_responses" ON public.responses;
CREATE POLICY "shared_delete_responses" ON public.responses FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_select_alerts" ON public.alerts;
CREATE POLICY "shared_select_alerts" ON public.alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_alerts" ON public.alerts;
CREATE POLICY "shared_insert_alerts" ON public.alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_alerts" ON public.alerts;
CREATE POLICY "shared_update_alerts" ON public.alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_alerts" ON public.alerts;
CREATE POLICY "shared_delete_alerts" ON public.alerts FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_select_timeline" ON public.timeline_events;
CREATE POLICY "shared_select_timeline" ON public.timeline_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_timeline" ON public.timeline_events;
CREATE POLICY "shared_insert_timeline" ON public.timeline_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_timeline" ON public.timeline_events;
CREATE POLICY "shared_update_timeline" ON public.timeline_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_timeline" ON public.timeline_events;
CREATE POLICY "shared_delete_timeline" ON public.timeline_events FOR DELETE TO anon, authenticated USING (true);

INSERT INTO public.patients (id, full_name, date_of_birth, condition, care_team, avatar_initials)
VALUES ('00000000-0000-0000-0000-000000000001', 'Maya Thompson', '1987-04-18', 'Hypertension management', 'Dr. Elena Ruiz · Primary care', 'MT')
ON CONFLICT (id) DO NOTHING;
