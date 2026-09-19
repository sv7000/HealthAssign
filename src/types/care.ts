export type View = 'doctor' | 'patient';
export type Tab = 'overview' | 'care-plans' | 'alerts' | 'timeline';
export type TaskType = 'medication' | 'temperature';
export type TaskStatus = 'pending' | 'completed';

export type Patient = { id: string; full_name: string; date_of_birth: string; condition: string; care_team: string; avatar_initials: string };
export type Task = { id: string; patient_id: string; task_type: TaskType; title: string; instructions: string; due_at: string; medication_name: string | null; dosage: string | null; status: TaskStatus; created_at: string };
export type Response = { id: string; task_id: string; patient_id: string; medication_taken: boolean | null; temperature_f: number | null; submitted_at: string };
export type Alert = { id: string; response_id: string; patient_id: string; alert_type: 'medication_not_taken' | 'high_temperature'; title: string; description: string; created_at: string };
export type TimelineEvent = { id: string; patient_id: string; event_type: 'task_created' | 'response_submitted' | 'alert_generated'; title: string; description: string; occurred_at: string; task_id: string | null; response_id: string | null; alert_id: string | null };
export type TaskForm = { taskType: TaskType; medicationName: string; dosage: string; instructions: string; dueAt: string };
