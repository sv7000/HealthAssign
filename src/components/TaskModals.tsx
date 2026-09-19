import { AlertTriangle, Droplets, Loader2, Thermometer, X } from "lucide-react";
import type { FormEvent } from "react";

export type TaskForm = {
  taskType: "medication" | "temperature";
  medicationName: string;
  dosage: string;
  instructions: string;
  dueAt: string;
};

type TaskModalProps = {
  form: TaskForm;
  busy: boolean;
  editing: boolean;
  onChange: (form: TaskForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TaskModal({
  form,
  busy,
  editing,
  onChange,
  onClose,
  onSubmit,
}: TaskModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Care plan</p>
            <h2>{editing ? "Edit task" : "Create a new task"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <label>
            Task type
            <div className="type-toggle">
              <button
                type="button"
                className={form.taskType === "medication" ? "selected" : ""}
                onClick={() => onChange({ ...form, taskType: "medication" })}
              >
                <Droplets size={16} /> Medication
              </button>
              <button
                type="button"
                className={form.taskType === "temperature" ? "selected" : ""}
                onClick={() => onChange({ ...form, taskType: "temperature" })}
              >
                <Thermometer size={16} /> Temperature
              </button>
            </div>
          </label>
          {form.taskType === "medication" && (
            <div className="form-row">
              <label>
                Medication name
                <input
                  required
                  placeholder="e.g. Paracetamol"
                  value={form.medicationName}
                  onChange={(event) =>
                    onChange({ ...form, medicationName: event.target.value })
                  }
                />
              </label>
              <label>
                Dose
                <input
                  required
                  placeholder="e.g. 650 mg"
                  value={form.dosage}
                  onChange={(event) =>
                    onChange({ ...form, dosage: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          <label>
            Instructions
            <textarea
              required
              rows={3}
              placeholder={
                form.taskType === "medication"
                  ? "Take with water after food."
                  : "Rest for 5 minutes, then record your temperature."
              }
              value={form.instructions}
              onChange={(event) =>
                onChange({ ...form, instructions: event.target.value })
              }
            />
          </label>
          <label>
            Due date and time
            <input
              required
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) =>
                onChange({ ...form, dueAt: event.target.value })
              }
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy && <Loader2 className="spin" size={15} />}{" "}
              {editing ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  type: "task" | "alert" | "all";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  type,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messages = {
    task: {
      title: "Delete this task?",
      body: "This will permanently remove the task, its patient response, and any associated alert. This cannot be undone.",
      confirm: "Delete task",
    },
    alert: {
      title: "Dismiss this alert?",
      body: "The alert will be removed from the workspace. The original patient response remains on record.",
      confirm: "Dismiss alert",
    },
    all: {
      title: "Reset the entire workspace?",
      body: "This will permanently delete all tasks, patient responses, alerts, and timeline events for Maya. The patient profile stays. This cannot be undone.",
      confirm: "Reset everything",
    },
  };
  const message = messages[type];
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card confirm-card">
        <div className="confirm-icon">
          <AlertTriangle size={28} />
        </div>
        <h2>{message.title}</h2>
        <p>{message.body}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button danger-btn"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="spin" size={15} />} {message.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
