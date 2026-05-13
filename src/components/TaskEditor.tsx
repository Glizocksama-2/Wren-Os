import { CheckCircle2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch } from "react";
import type { Priority, Task, TaskStatus, WorkspaceAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Badge, IconButton } from "./ui";

const statuses: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const priorities: Priority[] = ["low", "medium", "high", "critical"];

interface TaskEditorProps {
  task: Task;
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  onClose: () => void;
  onNotice?: (message: string) => void;
}

interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string;
  dueDate: string;
  tags: string;
  externalLinks: string;
  estimateMinutes: string;
  blockedReason: string;
  acceptanceCriteria: string;
}

export function TaskEditor({ task, state, dispatch, onClose, onNotice }: TaskEditorProps) {
  const [form, setForm] = useState<TaskFormState>(() => createTaskForm(task));
  const selectedProject = useMemo(
    () => state.projects.find((project) => project.id === task.projectId) ?? null,
    [state.projects, task.projectId]
  );

  useEffect(() => {
    setForm(createTaskForm(task));
  }, [task]);

  const updateForm = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveTask = () => {
    if (!form.title.trim()) {
      onNotice?.("Task needs a title before saving.");
      return;
    }

    const estimateValue = Number(form.estimateMinutes);
    dispatch({
      type: "task/update",
      id: task.id,
      payload: {
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        projectId: form.projectId === "none" ? null : form.projectId,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        tags: splitLinesOrCommas(form.tags),
        externalLinks: splitLines(form.externalLinks),
        estimateMinutes: Number.isFinite(estimateValue) && estimateValue > 0 ? estimateValue : null,
        blockedReason: form.blockedReason.trim() || null,
        acceptanceCriteria: splitLines(form.acceptanceCriteria)
      }
    });
    onNotice?.("Task details saved.");
  };

  const handoffTask = () => {
    dispatch({ type: "codex/handoff_task", taskId: task.id });
    onNotice?.("Codex handoff created from task details.");
  };

  const markDone = () => {
    dispatch({ type: "task/move", id: task.id, status: "done" });
    onNotice?.("Task marked done.");
  };

  return (
    <aside className="task-editor" aria-label={`Task details for ${task.title}`}>
      <div className="task-editor-head">
        <span>
          <small>Task Detail</small>
          <strong>{selectedProject?.name ?? "No project"}</strong>
        </span>
        <IconButton label="Close task details" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <label className="field-stack">
        <span>Title</span>
        <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
      </label>

      <label className="field-stack">
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={4} />
      </label>

      <div className="task-editor-grid">
        <label className="field-stack">
          <span>Status</span>
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value as TaskStatus)}>
            {statuses.map((status) => (
              <option value={status} key={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>Priority</span>
          <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value as Priority)}>
            {priorities.map((priority) => (
              <option value={priority} key={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>Due date</span>
          <input type="date" value={form.dueDate} onChange={(event) => updateForm("dueDate", event.target.value)} />
        </label>

        <label className="field-stack">
          <span>Estimate</span>
          <input
            type="number"
            min="0"
            step="5"
            value={form.estimateMinutes}
            onChange={(event) => updateForm("estimateMinutes", event.target.value)}
            placeholder="Minutes"
          />
        </label>
      </div>

      <label className="field-stack">
        <span>Project</span>
        <select value={form.projectId} onChange={(event) => updateForm("projectId", event.target.value)}>
          <option value="none">No project</option>
          {state.projects.map((project) => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field-stack">
        <span>Blocked reason</span>
        <input
          value={form.blockedReason}
          onChange={(event) => updateForm("blockedReason", event.target.value)}
          placeholder="Leave empty when the task is ready"
        />
      </label>

      <label className="field-stack">
        <span>Acceptance criteria</span>
        <textarea
          value={form.acceptanceCriteria}
          onChange={(event) => updateForm("acceptanceCriteria", event.target.value)}
          rows={4}
          placeholder="One done condition per line"
        />
      </label>

      <label className="field-stack">
        <span>Tags</span>
        <input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} placeholder="planning, codex" />
      </label>

      <label className="field-stack">
        <span>Links</span>
        <textarea value={form.externalLinks} onChange={(event) => updateForm("externalLinks", event.target.value)} rows={3} />
      </label>

      <div className="task-editor-status">
        <Badge tone={form.status}>{form.status.replace("_", " ")}</Badge>
        <Badge tone={form.priority}>{form.priority}</Badge>
        {form.blockedReason.trim() ? <Badge tone="coral">blocked</Badge> : <Badge tone="green">ready</Badge>}
      </div>

      <div className="task-editor-actions">
        <ActionButton tone="success" onClick={saveTask}>
          <CheckCircle2 size={16} /> Save task
        </ActionButton>
        <ActionButton onClick={handoffTask}>
          <Send size={16} /> Send to Codex
        </ActionButton>
        <ActionButton onClick={markDone} disabled={task.status === "done"}>
          Mark done
        </ActionButton>
      </div>
    </aside>
  );
}

function createTaskForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId ?? "none",
    dueDate: toDateInputValue(task.dueDate),
    tags: task.tags.join(", "),
    externalLinks: task.externalLinks.join("\n"),
    estimateMinutes: task.estimateMinutes ? String(task.estimateMinutes) : "",
    blockedReason: task.blockedReason ?? "",
    acceptanceCriteria: (task.acceptanceCriteria ?? []).join("\n")
  };
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLinesOrCommas(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
