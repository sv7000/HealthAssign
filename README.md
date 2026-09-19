# PulsePath - Remote Patient Monitoring Mini App

PulsePath is a small remote patient monitoring application for one **synthetic** patient. It provides separate doctor and patient workflows for assigning and completing medication and body-temperature tasks, then surfaces responses, rule-based alerts, and a chronological activity timeline.

> This project contains fictional clinical data only. It is not intended for real patient data or production clinical use.

## Features

- Doctor and patient views in one responsive React application
- Create medication and temperature tasks with due dates and instructions
- Record medication as **Taken** or **Not taken**
- Record body temperature in degrees Fahrenheit
- Persist tasks, responses, alerts, and timeline events in PostgreSQL via Supabase
- Generate alerts using database-side business rules:
  - **Medication not taken** when a medication response is `Not taken`
  - **High temperature** when a temperature is strictly greater than `101.0°F`
- Preserve the full activity history after browser refresh
- Prevent a second response and duplicate alert for the same task
- Light theme by default, with an optional dark theme and mobile-friendly layouts

## Technology

| Area                   | Choice                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| Frontend               | React 18, TypeScript, Vite                                                   |
| Styling                | CSS custom properties, responsive CSS, Tailwind base utilities               |
| Icons                  | Lucide React                                                                 |
| Persistence            | Supabase PostgreSQL                                                          |
| Backend/domain logic   | PostgreSQL functions, triggers, constraints, and Row Level Security policies |
| Formatting and quality | Prettier, ESLint, TypeScript                                                 |

## Architecture

```text
React UI
  -> Supabase JavaScript client
    -> PostgreSQL tables and RPC function
      -> validation, alert rules, timeline writes, constraints
```

The browser reads patient, task, response, alert, and timeline data through the Supabase client. Creating a patient response calls the `submit_patient_response` database function. That function validates the input, stores the response, marks the task complete, conditionally creates an alert, and records the timeline entries in one database transaction.

### Responsibilities

- **Frontend:** presentation, view switching, task-form validation for quick feedback, data loading, and human-readable error messages.
- **Database API/domain logic:** authoritative validation, response submission, task completion, deterministic alert creation, and timeline creation.
- **Persistence:** PostgreSQL tables, foreign keys, check constraints, unique constraints, indexes, and server-set timestamps.

## Data model

| Table             | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `patients`        | The single seeded synthetic patient, Maya Thompson        |
| `tasks`           | Medication or temperature tasks created by the doctor     |
| `responses`       | One saved patient response per task                       |
| `alerts`          | Exceptions generated from a response                      |
| `timeline_events` | Task, response, and alert activity in chronological order |

The schema and database logic are versioned in [`supabase/migrations`](./supabase/migrations):

1. `20260918150608_create_remote_monitoring_schema.sql` - tables, relationships, constraints, policies, indexes, and seed patient
2. `20260919053804_add_response_validation_function.sql` - response RPC, server-side validation, alert rules, and timeline events
3. `20260919054449_prevent_completed_task_edits.sql` - trigger that prevents completed tasks from being edited

## Prerequisites

- Node.js 18 or newer
- A Supabase project with PostgreSQL enabled

## Local setup

1. Clone the repository and enter it.

   ```bash
   git clone <your-private-repository-url>
   cd HealthAssign
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. In the Supabase SQL Editor, run the migration files in the order listed above.

4. Create a local `.env` file. Do not commit this file.

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server.

   ```bash
   npm run dev
   ```

6. Open the local URL printed by Vite.

The schema seeds the synthetic patient automatically. To start over during a demo, use **Reset workspace** in the doctor navigation.

## Available commands

| Command                | Purpose                               |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start the Vite development server     |
| `npm run build`        | Create a production build in `dist/`  |
| `npm run preview`      | Preview the production build locally  |
| `npm run lint`         | Run ESLint                            |
| `npm run typecheck`    | Run TypeScript without emitting files |
| `npm run format`       | Format files with Prettier            |
| `npm run format:check` | Check Prettier formatting             |

## API summary

The app uses Supabase's generated table API for normal reads and task CRUD. Patient response submission is intentionally routed through the database RPC below so the multi-step workflow is validated and atomic.

### `submit_patient_response`

```sql
submit_patient_response(
  p_task_id uuid,
  p_medication_taken boolean,
  p_temperature_f numeric
) -> jsonb
```

Rules enforced by the database function:

- The task must exist and still be pending.
- A medication task accepts only `p_medication_taken`.
- A temperature task accepts only `p_temperature_f` between `80` and `120`.
- `Not taken` creates a `medication_not_taken` alert.
- Temperature `> 101.0` creates a `high_temperature` alert; exactly `101.0` does not.
- The response, completed task state, optional alert, and timeline records are written as one transaction.

Useful errors are returned with PostgreSQL error codes that the UI maps to clear messages, including missing tasks, duplicate responses, invalid task/value combinations, out-of-range temperatures, and attempted edits to completed tasks.

## Idempotency and duplicate-alert prevention

Duplicate alert creation is prevented at more than one layer:

1. `responses.task_id` has a unique constraint, so a task can receive only one stored response.
2. `alerts` has a unique `(response_id, alert_type)` constraint.
3. The response function locks the task, rejects non-pending tasks, and does the full response/alert workflow atomically.

Therefore, a retry after a successful response cannot create a second response or alert for that task.

## Validation and timestamps

The UI validates required fields and the temperature range before submission to provide immediate feedback. The database repeats and owns the same important validation because browser input is untrusted.

All system timestamps are `timestamptz` values set by PostgreSQL's `now()`:

- task `created_at`
- response `submitted_at`
- alert `created_at`
- timeline event `occurred_at`

The task `due_at` value is supplied by the client and stored as `timestamptz`, so it remains unambiguous across time zones.

## Demonstration scenario

1. In **Doctor view**, create `Paracetamol 650 mg` due at 8:00 PM.
2. Create a **Body temperature** task due at 9:00 PM.
3. Switch to **Patient view** and mark the medication as **Not taken**.
4. Enter `102.2` for the temperature.
5. Return to Doctor view to see both alerts and the chronological timeline.
6. Refresh the browser; the saved tasks, responses, alerts, and timeline events remain available.

## Testing and verification

Run the current static checks with:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Automated database/domain tests are not yet included. The key alert thresholds, invalid response combinations, duplicate response rejection, and duplicate alert protections are enforced in the SQL schema/function and should be covered with integration tests before submitting an evaluation version.

## Assumptions and trade-offs

- There is one shared, synthetic patient and no authentication, matching the exercise's simplified UI scope.
- Supabase/PostgreSQL is used for persistence and domain logic to keep the project small and reliably persistent.
- The application uses Supabase's client/table API and Postgres RPC rather than a standalone Node/Express or Python/FastAPI service. This is a known deviation from the brief's explicit application-controlled HTTP API requirement; a production/evaluation revision should add that service layer.
- The initial RLS policies intentionally allow the anonymous shared demo workspace to read and write data. This is appropriate only for synthetic demo data.
- A reset control is included to make repeated demos convenient.


