-- Prevent updates to tasks that already have a patient response (status = 'completed').
-- The browser hides the edit button for completed tasks, but the data API is untrusted.
-- This trigger enforces the rule at the database level so a crafted UPDATE is rejected.

CREATE OR REPLACE FUNCTION prevent_completed_task_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
    RAISE EXCEPTION 'This task has already been completed by the patient and can no longer be edited.' USING ERRCODE = 'P0007';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_no_edit_after_completion ON public.tasks;
CREATE TRIGGER tasks_no_edit_after_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_task_edit();
