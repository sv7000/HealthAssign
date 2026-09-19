import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Droplets,
  Filter,
  HeartPulse,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  dateInputValue,
  formatDate,
  formatDateTime,
  formatTime,
  getInitialTheme,
  initialTaskForm,
  patientId,
  tabHeadings,
} from "@/lib/care";
import { ConfirmDialog, TaskModal } from "@/components/TaskModals";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import type {
  Alert,
  Patient,
  Response,
  Tab,
  Task,
  TaskForm,
  TimelineEvent,
  View,
} from "@/types/care";

function App() {
  const [view, setView] = useState<View>("doctor");
  const [tab, setTab] = useState<Tab>("overview");
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(initialTaskForm);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "task" | "alert" | "all";
    id?: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const [
      patientResult,
      tasksResult,
      responsesResult,
      alertsResult,
      timelineResult,
    ] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
      supabase
        .from("tasks")
        .select("*")
        .eq("patient_id", patientId)
        .order("due_at", { ascending: true }),
      supabase
        .from("responses")
        .select("*")
        .eq("patient_id", patientId)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("alerts")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("patient_id", patientId)
        .order("occurred_at", { ascending: false }),
    ]);
    const firstError = [
      patientResult.error,
      tasksResult.error,
      responsesResult.error,
      alertsResult.error,
      timelineResult.error,
    ].find(Boolean);
    if (firstError)
      setError(
        "Could not load the care workspace. Please refresh to try again.",
      );
    setPatient(patientResult.data);
    setTasks((tasksResult.data ?? []) as Task[]);
    setResponses((responsesResult.data ?? []) as Response[]);
    setAlerts((alertsResult.data ?? []) as Alert[]);
    setTimeline((timelineResult.data ?? []) as TimelineEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending"),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "completed"),
    [tasks],
  );
  const patientResponseFor = (taskId: string) =>
    responses.find((response) => response.task_id === taskId);

  const openCreateForm = () => {
    setEditingTask(null);
    setTaskForm(initialTaskForm());
    setShowTaskForm(true);
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      taskType: task.task_type,
      medicationName: task.medication_name ?? "",
      dosage: task.dosage ?? "",
      instructions: task.instructions,
      dueAt: dateInputValue(new Date(task.due_at)),
    });
    setShowTaskForm(true);
  };

  const saveTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!patient || busy) return;
    if (
      taskForm.taskType === "medication" &&
      (!taskForm.medicationName.trim() || !taskForm.dosage.trim())
    ) {
      setError("Add a medication name and dose before saving.");
      return;
    }
    if (!taskForm.instructions.trim() || !taskForm.dueAt) {
      setError("Add instructions and a due date before saving.");
      return;
    }
    setBusy(true);
    setError("");
    const isMedication = taskForm.taskType === "medication";
    const title = isMedication
      ? `${taskForm.medicationName.trim()} ${taskForm.dosage.trim()}`
      : "Body temperature";
    if (editingTask) {
      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update({
          task_type: taskForm.taskType,
          title,
          instructions: taskForm.instructions.trim(),
          due_at: new Date(taskForm.dueAt).toISOString(),
          medication_name: isMedication ? taskForm.medicationName.trim() : null,
          dosage: isMedication ? taskForm.dosage.trim() : null,
        })
        .eq("id", editingTask.id)
        .select()
        .maybeSingle();
      if (updateError || !updated) {
        setError(
          friendlyError(
            updateError,
            "Could not update this task. Please try again.",
          ),
        );
        setBusy(false);
        return;
      }
      setTasks((current) =>
        current
          .map((t) => (t.id === editingTask.id ? (updated as Task) : t))
          .sort((a, b) => a.due_at.localeCompare(b.due_at)),
      );
      setEditingTask(null);
      setTaskForm(initialTaskForm());
      setShowTaskForm(false);
      setToast("Task updated");
      setBusy(false);
    } else {
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          patient_id: patient.id,
          task_type: taskForm.taskType,
          title,
          instructions: taskForm.instructions.trim(),
          due_at: new Date(taskForm.dueAt).toISOString(),
          medication_name: isMedication ? taskForm.medicationName.trim() : null,
          dosage: isMedication ? taskForm.dosage.trim() : null,
        })
        .select()
        .maybeSingle();
      if (taskError || !task) {
        setError("Could not save this task. Please try again.");
        setBusy(false);
        return;
      }
      const { error: timelineError } = await supabase
        .from("timeline_events")
        .insert({
          patient_id: patient.id,
          event_type: "task_created",
          title: "Task assigned",
          description: `${title} was added to Maya\u2019s care plan.`,
          task_id: task.id,
        });
      if (timelineError)
        setError(
          "The task was saved but the activity log could not be updated.",
        );
      setTasks((current) =>
        [...current, task as Task].sort((a, b) =>
          a.due_at.localeCompare(b.due_at),
        ),
      );
      if (!timelineError)
        setTimeline((current) => [
          {
            id: crypto.randomUUID(),
            patient_id: patient.id,
            event_type: "task_created",
            title: "Task assigned",
            description: `${title} was added to Maya\u2019s care plan.`,
            occurred_at: new Date().toISOString(),
            task_id: task.id,
            response_id: null,
            alert_id: null,
          },
          ...current,
        ]);
      setTaskForm(initialTaskForm());
      setShowTaskForm(false);
      setToast("Task added to Maya\u2019s care plan");
      setBusy(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (deleteError) {
      setError("Could not delete this task. Please try again.");
      setBusy(false);
      return;
    }
    const deletedResponseIds = responses
      .filter((r) => r.task_id === taskId)
      .map((r) => r.id);
    setTasks((current) => current.filter((t) => t.id !== taskId));
    setResponses((current) => current.filter((r) => r.task_id !== taskId));
    setAlerts((current) =>
      current.filter((a) => !deletedResponseIds.includes(a.response_id)),
    );
    setTimeline((current) =>
      current.filter(
        (e) =>
          e.task_id !== taskId &&
          !deletedResponseIds.includes(e.response_id ?? ""),
      ),
    );
    setConfirmDelete(null);
    setToast("Task deleted");
    setBusy(false);
  };

  const deleteAlert = async (alertId: string) => {
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("alerts")
      .delete()
      .eq("id", alertId);
    if (deleteError) {
      setError("Could not dismiss this alert. Please try again.");
      setBusy(false);
      return;
    }
    setAlerts((current) => current.filter((a) => a.id !== alertId));
    setTimeline((current) => current.filter((e) => e.alert_id !== alertId));
    setConfirmDelete(null);
    setToast("Alert dismissed");
    setBusy(false);
  };

  const resetAllData = async () => {
    setBusy(true);
    setError("");
    const { error: timelineDeleteError } = await supabase
      .from("timeline_events")
      .delete()
      .eq("patient_id", patientId);
    if (timelineDeleteError) {
      setError("Could not reset the workspace. Please try again.");
      setBusy(false);
      return;
    }
    const { error: alertDeleteError } = await supabase
      .from("alerts")
      .delete()
      .eq("patient_id", patientId);
    if (alertDeleteError) {
      setError("Could not reset the workspace. Please try again.");
      setBusy(false);
      return;
    }
    const { error: responseDeleteError } = await supabase
      .from("responses")
      .delete()
      .eq("patient_id", patientId);
    if (responseDeleteError) {
      setError("Could not reset the workspace. Please try again.");
      setBusy(false);
      return;
    }
    const { error: taskDeleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("patient_id", patientId);
    if (taskDeleteError) {
      setError("Could not reset the workspace. Please try again.");
      setBusy(false);
      return;
    }
    setTasks([]);
    setResponses([]);
    setAlerts([]);
    setTimeline([]);
    setConfirmDelete(null);
    setToast("Workspace reset \u2014 ready for a fresh start");
    setBusy(false);
  };

  const friendlyError = (
    error: { code?: string; message?: string } | null,
    fallback: string,
  ): string => {
    if (!error) return fallback;
    if (error.code === "23505")
      return "This task already has a saved response.";
    if (error.code === "P0002")
      return "That task could not be found. It may have been deleted.";
    if (error.code === "P0003")
      return "This task already has a saved response.";
    if (error.code === "P0004")
      return "The response does not match the task type.";
    if (error.code === "P0005")
      return "Enter a temperature between 80 and 120°F.";
    if (error.code === "P0006") return "This task type is not recognized.";
    if (error.code === "P0007")
      return "This task has already been completed by the patient and can no longer be edited.";
    return fallback;
  };

  const submitResponse = async (task: Task, value: boolean | number) => {
    if (busy || !patient || patientResponseFor(task.id)) return;
    if (
      task.task_type === "temperature" &&
      (typeof value !== "number" || value < 80 || value > 120)
    ) {
      setError("Enter a temperature between 80 and 120°F.");
      return;
    }
    setBusy(true);
    setError("");
    const { data: result, error: rpcError } = await supabase.rpc(
      "submit_patient_response",
      {
        p_task_id: task.id,
        p_medication_taken:
          task.task_type === "medication" ? (value as boolean) : null,
        p_temperature_f:
          task.task_type === "temperature" ? (value as number) : null,
      },
    );
    if (rpcError || !result) {
      setError(
        friendlyError(
          rpcError,
          "The response could not be saved. Please try again.",
        ),
      );
      setBusy(false);
      return;
    }
    const r = result as {
      response_id: string;
      alert_id: string | null;
      alert_type: string | null;
      alert_title: string | null;
      alert_description: string | null;
      response_description: string;
      patient_id: string;
      task_id: string;
    };
    const now = new Date().toISOString();
    const savedResponse: Response = {
      id: r.response_id,
      task_id: task.id,
      patient_id: r.patient_id,
      medication_taken:
        task.task_type === "medication" ? (value as boolean) : null,
      temperature_f:
        task.task_type === "temperature" ? (value as number) : null,
      submitted_at: now,
    };
    const createdAlert: Alert | null = r.alert_id
      ? {
          id: r.alert_id,
          response_id: r.response_id,
          patient_id: r.patient_id,
          alert_type: r.alert_type as Alert["alert_type"],
          title: r.alert_title!,
          description: r.alert_description!,
          created_at: now,
        }
      : null;
    setResponses((current) => [savedResponse, ...current]);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: "completed" } : item,
      ),
    );
    if (createdAlert) setAlerts((current) => [createdAlert, ...current]);
    setTimeline((current) => [
      {
        id: crypto.randomUUID(),
        patient_id: r.patient_id,
        event_type: "response_submitted",
        title: "Patient response received",
        description: r.response_description,
        occurred_at: now,
        task_id: task.id,
        response_id: r.response_id,
        alert_id: null,
      },
      ...(createdAlert
        ? [
            {
              id: crypto.randomUUID(),
              patient_id: r.patient_id,
              event_type: "alert_generated" as const,
              title: createdAlert.title,
              description: createdAlert.description,
              occurred_at: now,
              task_id: null,
              response_id: r.response_id,
              alert_id: createdAlert.id,
            },
          ]
        : []),
      ...current,
    ]);
    setToast(
      createdAlert
        ? `${createdAlert.title} alert generated`
        : "Response saved securely",
    );
    setBusy(false);
  };

  if (loading)
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={28} />
        <span>Loading care workspace</span>
      </div>
    );

  const onAdd = () => {
    setError("");
    openCreateForm();
  };

  const heading =
    view === "patient"
      ? {
          title: "Hi, Maya.",
          sub: "Here\u2019s what your care team would like you to complete today.",
        }
      : tabHeadings[tab];

  const handleNavClick = (id: Tab) => {
    setView("doctor");
    setTab(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="app-shell">
      <AppSidebar
        view={view}
        tab={tab}
        pendingCount={pendingTasks.length}
        alertCount={alerts.length}
        mobileOpen={mobileNavOpen}
        onNavigate={handleNavClick}
        onCloseMobile={() => setMobileNavOpen(false)}
        onReset={() => setConfirmDelete({ type: "all" })}
      />
      <main className="main-content">
        <AppHeader
          view={view}
          tab={tab}
          theme={theme}
          alertCount={alerts.length}
          onOpenMenu={() => setMobileNavOpen(true)}
          onToggleTheme={() =>
            setTheme((current) => (current === "light" ? "dark" : "light"))
          }
        />
        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Friday, September 18, 2026</p>
              <h1>{heading.title}</h1>
              <p className="heading-sub">{heading.sub}</p>
            </div>
            <div className="mode-switch">
              <button
                className={view === "doctor" ? "selected" : ""}
                onClick={() => setView("doctor")}
              >
                <UserRound size={16} /> Doctor view
              </button>
              <button
                className={view === "patient" ? "selected" : ""}
                onClick={() => setView("patient")}
              >
                <HeartPulse size={16} /> Patient view
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!patient ? (
            <div className="empty-state">
              <AlertTriangle size={32} />
              <h2>Patient profile unavailable</h2>
              <p>Refresh to reconnect to the monitoring workspace.</p>
              <button
                className="button primary"
                onClick={() => void loadData()}
              >
                <RefreshCw size={16} /> Try again
              </button>
            </div>
          ) : view === "patient" ? (
            <PatientView
              tasks={tasks}
              responses={responses}
              onRespond={submitResponse}
              busy={busy}
            />
          ) : tab === "overview" ? (
            <DoctorView
              patient={patient}
              tasks={tasks}
              responses={responses}
              alerts={alerts}
              timeline={timeline}
              completedTasks={completedTasks}
              pendingTasks={pendingTasks}
              onAdd={onAdd}
              onNavigate={setTab}
            />
          ) : tab === "care-plans" ? (
            <CarePlansPage
              patient={patient}
              tasks={tasks}
              responses={responses}
              pendingTasks={pendingTasks}
              completedTasks={completedTasks}
              onAdd={onAdd}
              onEdit={openEditForm}
              onDelete={(id) => setConfirmDelete({ type: "task", id })}
              onRefresh={() => void loadData()}
            />
          ) : tab === "alerts" ? (
            <AlertsPage
              alerts={alerts}
              tasks={tasks}
              responses={responses}
              onRefresh={() => void loadData()}
              onDelete={(id) => setConfirmDelete({ type: "alert", id })}
            />
          ) : (
            <TimelinePage
              patient={patient}
              timeline={timeline}
              tasks={tasks}
              onRefresh={() => void loadData()}
            />
          )}
        </div>
      </main>
      {showTaskForm && (
        <TaskModal
          form={taskForm}
          busy={busy}
          editing={!!editingTask}
          onChange={setTaskForm}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          onSubmit={saveTask}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          type={confirmDelete.type}
          busy={busy}
          onConfirm={() => {
            if (confirmDelete.type === "task" && confirmDelete.id)
              void deleteTask(confirmDelete.id);
            else if (confirmDelete.type === "alert" && confirmDelete.id)
              void deleteAlert(confirmDelete.id);
            else if (confirmDelete.type === "all") void resetAllData();
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function DoctorView({
  patient,
  tasks,
  responses,
  alerts,
  timeline,
  completedTasks,
  pendingTasks,
  onAdd,
  onNavigate,
}: {
  patient: Patient;
  tasks: Task[];
  responses: Response[];
  alerts: Alert[];
  timeline: TimelineEvent[];
  completedTasks: Task[];
  pendingTasks: Task[];
  onAdd: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <>
      <section className="patient-hero">
        <div className="patient-main">
          <div className="patient-avatar">{patient.avatar_initials}</div>
          <div>
            <div className="patient-name-row">
              <h2>{patient.full_name}</h2>
              <span className="active-tag">
                <span /> Active monitoring
              </span>
            </div>
            <p>{patient.condition}</p>
            <div className="patient-meta">
              <span>
                <CalendarClock size={15} /> DOB{" "}
                {formatDate(patient.date_of_birth)}
              </span>
              <span>
                <HeartPulse size={15} /> {patient.care_team}
              </span>
            </div>
          </div>
        </div>
        <button className="button secondary">
          <UserRound size={16} /> View profile <ArrowUpRight size={15} />
        </button>
      </section>
      <div className="stat-grid">
        <StatCard
          label="Open tasks"
          value={pendingTasks.length.toString().padStart(2, "0")}
          note={pendingTasks.length ? "Needs patient action" : "All caught up"}
          icon={<ClipboardList size={18} />}
          tone="blue"
        />
        <StatCard
          label="Completed"
          value={completedTasks.length.toString().padStart(2, "0")}
          note="Total responses"
          icon={<CheckCircle2 size={18} />}
          tone="green"
        />
        <StatCard
          label="Alerts"
          value={alerts.length.toString().padStart(2, "0")}
          note={alerts.length ? "Review recommended" : "No exceptions"}
          icon={<Bell size={18} />}
          tone="orange"
        />
        <StatCard
          label="Last activity"
          value={
            responses[0] ? formatTime(responses[0].submitted_at) : "\u2014"
          }
          note={
            responses[0]
              ? formatDate(responses[0].submitted_at)
              : "Awaiting response"
          }
          icon={<Activity size={18} />}
          tone="slate"
        />
      </div>
      <div className="content-grid">
        <section className="panel tasks-panel">
          <PanelHeading
            icon={<ClipboardList size={18} />}
            title="Care plan tasks"
            description="Assigned actions for Maya"
            action={
              <button className="button primary small" onClick={onAdd}>
                <Plus size={16} /> Create task
              </button>
            }
          />
          {tasks.length === 0 ? (
            <EmptyTasks onAdd={onAdd} />
          ) : (
            <div className="task-list">
              {tasks.slice(0, 5).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  response={responses.find((item) => item.task_id === task.id)}
                />
              ))}
            </div>
          )}
          <div className="panel-footer">
            <span>
              {tasks.length} task{tasks.length === 1 ? "" : "s"} in care plan
            </span>
            <button
              className="text-button"
              onClick={() => onNavigate("care-plans")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel alerts-panel">
          <PanelHeading
            icon={<Bell size={18} />}
            title="Attention needed"
            description="Exceptions from patient responses"
          />
          {alerts.length === 0 ? (
            <div className="quiet-state">
              <div className="quiet-icon">
                <ShieldCheck size={24} />
              </div>
              <strong>Everything looks steady</strong>
              <span>Alerts will appear here when a response needs review.</span>
            </div>
          ) : (
            <div className="alert-list">
              {alerts.slice(0, 3).map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          )}
          <div className="panel-footer">
            <span>
              {alerts.length
                ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"} to review`
                : "No alerts today"}
            </span>
            <button
              className="text-button"
              onClick={() => onNavigate("alerts")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <TimelinePanel
        timeline={timeline}
        tasks={tasks}
        onViewAll={() => onNavigate("timeline")}
        compact
      />
    </>
  );
}

function CarePlansPage({
  patient,
  tasks,
  responses,
  pendingTasks,
  completedTasks,
  onAdd,
  onEdit,
  onDelete,
  onRefresh,
}: {
  patient: Patient;
  tasks: Task[];
  responses: Response[];
  pendingTasks: Task[];
  completedTasks: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const filtered =
    filter === "all"
      ? tasks
      : filter === "pending"
        ? pendingTasks
        : completedTasks;
  return (
    <>
      <div className="page-actions-bar">
        <div className="filter-tabs">
          <Filter size={15} />
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All <span className="filter-count">{tasks.length}</span>
          </button>
          <button
            className={filter === "pending" ? "selected" : ""}
            onClick={() => setFilter("pending")}
          >
            Pending <span className="filter-count">{pendingTasks.length}</span>
          </button>
          <button
            className={filter === "completed" ? "selected" : ""}
            onClick={() => setFilter("completed")}
          >
            Completed{" "}
            <span className="filter-count">{completedTasks.length}</span>
          </button>
        </div>
        <div className="page-actions-right">
          <button className="button secondary" onClick={onRefresh}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="button primary" onClick={onAdd}>
            <Plus size={16} /> Create task
          </button>
        </div>
      </div>
      <section className="panel full-panel">
        <PanelHeading
          icon={<ClipboardList size={18} />}
          title="All care plan tasks"
          description={`${filtered.length} task${filtered.length === 1 ? "" : "s"} shown`}
        />
        {filtered.length === 0 ? (
          <div className="empty-tasks">
            <div className="empty-icon">
              <ClipboardList size={25} />
            </div>
            <strong>
              {filter === "pending"
                ? "No pending tasks"
                : filter === "completed"
                  ? "No completed tasks yet"
                  : "No tasks assigned yet"}
            </strong>
            <span>
              {filter === "all"
                ? "Create the first care action for Maya to complete."
                : "Tasks will appear here when available."}
            </span>
            {filter === "all" && (
              <button className="text-button" onClick={onAdd}>
                Create a task <Plus size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="task-card-grid">
            {filtered.map((task) => {
              const response = responses.find(
                (item) => item.task_id === task.id,
              );
              return (
                <div className="task-card" key={task.id}>
                  <div className="task-card-header">
                    <div className={`task-card-icon ${task.task_type}`}>
                      {task.task_type === "medication" ? (
                        <Droplets size={20} />
                      ) : (
                        <Thermometer size={20} />
                      )}
                    </div>
                    <div className="task-card-header-info">
                      <span className="task-card-type">
                        {task.task_type === "medication"
                          ? "Medication"
                          : "Measurement"}
                      </span>
                      <h3 className="task-card-title">{task.title}</h3>
                    </div>
                    <span
                      className={`status-badge ${task.status} task-card-status`}
                    >
                      {task.status === "completed" ? (
                        <Check size={13} />
                      ) : (
                        <Clock3 size={13} />
                      )}
                      {task.status === "completed"
                        ? response?.temperature_f
                          ? `${response.temperature_f}°F recorded`
                          : response?.medication_taken
                            ? "Taken"
                            : "Not taken"
                        : "Open"}
                    </span>
                  </div>
                  <div className="task-card-body">
                    <p className="task-card-instructions">
                      {task.instructions}
                    </p>
                  </div>
                  <div className="task-card-meta">
                    <span className="task-meta-chip">
                      <CalendarClock size={13} /> Due{" "}
                      {formatDateTime(task.due_at)}
                    </span>
                    {task.medication_name && (
                      <span className="task-meta-chip">
                        <Droplets size={13} /> {task.medication_name}{" "}
                        {task.dosage}
                      </span>
                    )}
                    {response && (
                      <span className="task-meta-chip">
                        <Check size={13} /> Responded{" "}
                        {formatDateTime(response.submitted_at)}
                      </span>
                    )}
                  </div>
                  <div className="task-card-footer">
                    <div className="task-card-actions">
                      {task.status === "pending" && (
                        <button
                          className="icon-button small"
                          onClick={() => onEdit(task)}
                          aria-label="Edit task"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      <button
                        className="icon-button small danger"
                        onClick={() => onDelete(task.id)}
                        aria-label="Delete task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="panel-footer">
          <span>
            {tasks.length} total task{tasks.length === 1 ? "" : "s"} in care
            plan
          </span>
          <span>Assigned to {patient.full_name}</span>
        </div>
      </section>
    </>
  );
}

function AlertsPage({
  alerts,
  tasks,
  responses,
  onRefresh,
  onDelete,
}: {
  alerts: Alert[];
  tasks: Task[];
  responses: Response[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  const medAlerts = alerts.filter(
    (a) => a.alert_type === "medication_not_taken",
  );
  const tempAlerts = alerts.filter((a) => a.alert_type === "high_temperature");
  return (
    <>
      <div className="page-actions-bar">
        <div className="alert-summary-bar">
          <div className="alert-summary-chip">
            <Bell size={16} /> <strong>{alerts.length}</strong> total
          </div>
          <div className="alert-summary-chip">
            <Droplets size={16} /> <strong>{medAlerts.length}</strong>{" "}
            medication
          </div>
          <div className="alert-summary-chip">
            <Thermometer size={16} /> <strong>{tempAlerts.length}</strong>{" "}
            temperature
          </div>
        </div>
        <button className="button secondary" onClick={onRefresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {alerts.length === 0 ? (
        <section className="panel full-panel">
          <div className="quiet-state large">
            <div className="quiet-icon">
              <ShieldCheck size={32} />
            </div>
            <strong>No alerts to review</strong>
            <span>
              When Maya misses a medication or records a high temperature, the
              exception will appear here for follow-up.
            </span>
          </div>
        </section>
      ) : (
        <div className="alert-page-grid">
          {alerts.map((alert) => {
            const response = responses.find((r) => r.id === alert.response_id);
            const task = response
              ? tasks.find((t) => t.id === response.task_id)
              : undefined;
            return (
              <div className="alert-card" key={alert.id}>
                <div className={`alert-card-icon ${alert.alert_type}`}>
                  {alert.alert_type === "medication_not_taken" ? (
                    <Droplets size={20} />
                  ) : (
                    <Thermometer size={20} />
                  )}
                </div>
                <div className="alert-card-body">
                  <div className="alert-card-header">
                    <strong>{alert.title}</strong>
                    <span className={`alert-type-tag ${alert.alert_type}`}>
                      {alert.alert_type === "medication_not_taken"
                        ? "Medication"
                        : "Temperature"}
                    </span>
                  </div>
                  <p>{alert.description}</p>
                  <div className="alert-card-meta">
                    {task && (
                      <span className="task-meta-chip">
                        <ClipboardList size={13} /> {task.title}
                      </span>
                    )}
                    {response?.temperature_f != null && (
                      <span className="task-meta-chip">
                        <Thermometer size={13} /> {response.temperature_f}°F
                      </span>
                    )}
                    <span className="task-meta-chip">
                      <Clock3 size={13} /> {formatDateTime(alert.created_at)}
                    </span>
                  </div>
                  <button
                    className="text-button dismiss-btn"
                    onClick={() => onDelete(alert.id)}
                  >
                    <Trash2 size={14} /> Dismiss alert
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TimelinePage({
  patient,
  timeline,
  tasks,
  onRefresh,
}: {
  patient: Patient;
  timeline: TimelineEvent[];
  tasks: Task[];
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<
    "all" | "task_created" | "response_submitted" | "alert_generated"
  >("all");
  const filtered =
    filter === "all"
      ? timeline
      : timeline.filter((e) => e.event_type === filter);
  const counts = {
    all: timeline.length,
    task_created: timeline.filter((e) => e.event_type === "task_created")
      .length,
    response_submitted: timeline.filter(
      (e) => e.event_type === "response_submitted",
    ).length,
    alert_generated: timeline.filter((e) => e.event_type === "alert_generated")
      .length,
  };
  return (
    <>
      <div className="page-actions-bar">
        <div className="filter-tabs">
          <Filter size={15} />
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All <span className="filter-count">{counts.all}</span>
          </button>
          <button
            className={filter === "task_created" ? "selected" : ""}
            onClick={() => setFilter("task_created")}
          >
            Tasks <span className="filter-count">{counts.task_created}</span>
          </button>
          <button
            className={filter === "response_submitted" ? "selected" : ""}
            onClick={() => setFilter("response_submitted")}
          >
            Responses{" "}
            <span className="filter-count">{counts.response_submitted}</span>
          </button>
          <button
            className={filter === "alert_generated" ? "selected" : ""}
            onClick={() => setFilter("alert_generated")}
          >
            Alerts{" "}
            <span className="filter-count">{counts.alert_generated}</span>
          </button>
        </div>
        <button className="button secondary" onClick={onRefresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <section className="panel full-panel">
        <PanelHeading
          icon={<Activity size={18} />}
          title="Full activity timeline"
          description={`${filtered.length} event${filtered.length === 1 ? "" : "s"} for ${patient.full_name}`}
        />
        {filtered.length === 0 ? (
          <div className="quiet-state compact">
            <Activity size={22} />
            <span>No events match this filter yet.</span>
          </div>
        ) : (
          <div className="timeline-list full">
            {filtered.map((event) => (
              <div className="timeline-row" key={event.id}>
                <div className={`timeline-dot ${event.event_type}`}>
                  <span />
                </div>
                <div className="timeline-copy">
                  <strong>{event.title}</strong>
                  <span>{event.description}</span>
                </div>
                <time>{formatDateTime(event.occurred_at)}</time>
              </div>
            ))}
          </div>
        )}
        <div className="timeline-context">
          <ShieldCheck size={15} />
          <span>
            All activity is recorded securely and visible to the care team.
          </span>
          <span className="context-task-count">
            {tasks.length} assigned tasks
          </span>
        </div>
      </section>
    </>
  );
}

function PatientView({
  tasks,
  responses,
  onRespond,
  busy,
}: {
  tasks: Task[];
  responses: Response[];
  onRespond: (task: Task, value: boolean | number) => Promise<void>;
  busy: boolean;
}) {
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  const openTasks = tasks.filter((task) => task.status === "pending");
  const setTemp = (taskId: string, value: string) =>
    setTempValues((prev) => ({ ...prev, [taskId]: value }));
  const handleSubmitTemp = async (task: Task) => {
    const value = tempValues[task.id];
    if (!value) return;
    await onRespond(task, Number(value));
    setTempValues((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
  };
  return (
    <div className="patient-view">
      <div className="patient-welcome">
        <div>
          <p className="eyebrow">Your health companion</p>
          <h2>Hi, Maya.</h2>
          <p>
            Here\u2019s what your care team would like you to complete today.
          </p>
        </div>
        <div className="patient-check">
          <CheckCircle2 size={20} />
          <span>
            {tasks.length - openTasks.length} of {tasks.length} complete
          </span>
        </div>
      </div>
      <div className="patient-task-grid">
        {openTasks.length === 0 ? (
          <div className="patient-done">
            <div className="done-icon">
              <Check size={26} />
            </div>
            <h3>You are all caught up</h3>
            <p>
              There are no open tasks right now. Your care team can add new
              tasks at any time.
            </p>
          </div>
        ) : (
          openTasks.map((task) => (
            <div
              className={`patient-task-card ${task.task_type}`}
              key={task.id}
            >
              <div className="patient-task-top">
                <div className={`task-type-icon ${task.task_type}`}>
                  {task.task_type === "medication" ? (
                    <Droplets size={22} />
                  ) : (
                    <Thermometer size={22} />
                  )}
                </div>
                <div className="patient-task-meta-top">
                  <span className="task-kicker">
                    {task.task_type === "medication"
                      ? "Medication reminder"
                      : "Temperature check"}
                  </span>
                  <span className="patient-task-due">
                    <Clock3 size={13} /> Due {formatTime(task.due_at)} ·{" "}
                    {formatDate(task.due_at)}
                  </span>
                </div>
              </div>
              <div className="patient-task-body">
                <h3>{task.title}</h3>
                <p>{task.instructions}</p>
              </div>
              {task.task_type === "medication" ? (
                <div className="response-buttons">
                  <button
                    className="button response-no"
                    disabled={busy}
                    onClick={() => void onRespond(task, false)}
                  >
                    <X size={16} /> Not taken
                  </button>
                  <button
                    className="button response-yes"
                    disabled={busy}
                    onClick={() => void onRespond(task, true)}
                  >
                    <Check size={16} /> Taken
                  </button>
                </div>
              ) : (
                <div className="temperature-response">
                  <div className="temp-input-row">
                    <div className="input-with-unit">
                      <input
                        type="number"
                        step="0.1"
                        min="80"
                        max="120"
                        placeholder="e.g. 98.6"
                        value={tempValues[task.id] ?? ""}
                        onChange={(event) =>
                          setTemp(task.id, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleSubmitTemp(task);
                          }
                        }}
                      />
                      <span>°F</span>
                    </div>
                  </div>
                  <button
                    className="button primary"
                    disabled={busy || !tempValues[task.id]}
                    onClick={() => void handleSubmitTemp(task)}
                  >
                    Save reading <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}{" "}
      </div>
      <section className="patient-history panel">
        <PanelHeading
          icon={<Clock3 size={18} />}
          title="Your recent activity"
          description="Responses sent to your care team"
        />
        {responses.length === 0 ? (
          <div className="quiet-state compact">
            <Clock3 size={22} />
            <span>Your completed responses will show here.</span>
          </div>
        ) : (
          <div className="response-history">
            {responses.slice(0, 5).map((response) => {
              const task = tasks.find((item) => item.id === response.task_id);
              return (
                <div className="history-row" key={response.id}>
                  <div className="history-check">
                    <Check size={14} />
                  </div>
                  <div>
                    <strong>{task?.title ?? "Completed task"}</strong>
                    <span>
                      {response.temperature_f
                        ? `${response.temperature_f}°F recorded`
                        : response.medication_taken
                          ? "Marked as taken"
                          : "Marked as not taken"}
                    </span>
                  </div>
                  <time>{formatDateTime(response.submitted_at)}</time>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}
function PanelHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div className="panel-title">
        <div className="panel-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
function TaskRow({ task, response }: { task: Task; response?: Response }) {
  return (
    <div className="task-row">
      <div className={`task-icon ${task.task_type}`}>
        {task.task_type === "medication" ? (
          <Droplets size={19} />
        ) : (
          <Thermometer size={19} />
        )}
      </div>
      <div className="task-copy">
        <strong>{task.title}</strong>
        <span>{task.instructions}</span>
      </div>
      <div className="task-due">
        <Clock3 size={14} />
        <span>
          {formatDate(task.due_at)}
          <b>{formatTime(task.due_at)}</b>
        </span>
      </div>
      <span className={`status-badge ${task.status}`}>
        {task.status === "completed" ? (
          <Check size={13} />
        ) : (
          <Clock3 size={13} />
        )}
        {task.status === "completed"
          ? response?.temperature_f
            ? `${response.temperature_f}°F recorded`
            : response?.medication_taken
              ? "Taken"
              : "Not taken"
          : "Open"}
      </span>
    </div>
  );
}
function AlertRow({ alert }: { alert: Alert }) {
  return (
    <div className="alert-row">
      <div className="alert-icon">
        <AlertTriangle size={17} />
      </div>
      <div>
        <strong>{alert.title}</strong>
        <span>{alert.description}</span>
        <small>{formatDateTime(alert.created_at)}</small>
      </div>
      <button className="alert-arrow" aria-label="Open alert">
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
function TimelinePanel({
  timeline,
  tasks,
  onViewAll,
  compact,
}: {
  timeline: TimelineEvent[];
  tasks: Task[];
  onViewAll: () => void;
  compact?: boolean;
}) {
  return (
    <section className="panel timeline-panel">
      <PanelHeading
        icon={<Activity size={18} />}
        title="Patient timeline"
        description="A chronological view of Maya\u2019s care activity"
        action={
          <button className="text-button" onClick={onViewAll}>
            Full timeline <ArrowUpRight size={14} />
          </button>
        }
      />
      {timeline.length === 0 ? (
        <div className="quiet-state compact">
          <Activity size={22} />
          <span>Task creation and patient responses will appear here.</span>
        </div>
      ) : (
        <div className="timeline-list">
          {timeline.slice(0, compact ? 6 : 100).map((event) => (
            <div className="timeline-row" key={event.id}>
              <div className={`timeline-dot ${event.event_type}`}>
                <span />
              </div>
              <div className="timeline-copy">
                <strong>{event.title}</strong>
                <span>{event.description}</span>
              </div>
              <time>{formatDateTime(event.occurred_at)}</time>
            </div>
          ))}
        </div>
      )}
      <div className="timeline-context">
        <ShieldCheck size={15} />
        <span>
          All activity is recorded securely and visible to the care team.
        </span>
        <span className="context-task-count">
          {tasks.length} assigned tasks
        </span>
      </div>
    </section>
  );
}
function EmptyTasks({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-tasks">
      <div className="empty-icon">
        <ClipboardList size={25} />
      </div>
      <strong>No tasks assigned yet</strong>
      <span>Create the first care action for Maya to complete.</span>
      <button className="text-button" onClick={onAdd}>
        Create a task <Plus size={14} />
      </button>
    </div>
  );
}

export default App;
