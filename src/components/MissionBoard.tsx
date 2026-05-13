import { Filter, Plus } from "lucide-react";
import { useMemo, useState, type Dispatch } from "react";
import { formatShortDate, getProjectName, isTaskOverdue, sortTasksForExecution } from "../store/workspace";
import type { Priority, TaskStatus, WorkspaceAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Badge, EmptyState } from "./ui";
import { TaskEditor } from "./TaskEditor";

const columns: Array<{ id: TaskStatus; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" }
];

export function MissionBoard({
  state,
  dispatch,
  onNotice
}: {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  onNotice?: (message: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("p-wren");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const tasks = sortTasksForExecution(state.tasks);
    if (!normalized) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.description} ${task.tags.join(" ")} ${task.blockedReason ?? ""} ${(task.acceptanceCriteria ?? []).join(" ")}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, state.tasks]);
  const selectedTask = selectedTaskId ? state.tasks.find((task) => task.id === selectedTaskId) : undefined;

  const createTask = () => {
    if (!title.trim()) return;
    dispatch({
      type: "task/create",
      payload: {
        title: title.trim(),
        description: description.trim() || "Created from the Mission Board.",
        priority,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        tags: ["mission-board"],
        projectId,
        source: "manual"
      }
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setShowForm(false);
  };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Mission Board</h1>
          <p>Move work through the operating loop and keep agents honest about state.</p>
        </div>
        <div className="title-actions">
          <div className="filter-input">
            <Filter size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tasks" />
          </div>
          <ActionButton tone="primary" onClick={() => setShowForm((value) => !value)}>
            <Plus size={16} /> Add task
          </ActionButton>
        </div>
      </div>

      {showForm && (
        <div className="inline-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" autoFocus />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Useful context" />
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {state.projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <ActionButton tone="primary" onClick={createTask}>
            Create
          </ActionButton>
        </div>
      )}

      <div className="board-grid">
        {columns.map((column) => {
          const tasks = filteredTasks.filter((task) => task.status === column.id);
          return (
            <section
              className="board-column"
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingId) dispatch({ type: "task/move", id: draggingId, status: column.id });
                setDraggingId(null);
              }}
            >
              <div className="board-head">
                <h2>{column.label}</h2>
                <Badge tone={column.id}>{tasks.length}</Badge>
              </div>
              {tasks.length === 0 && <EmptyState>Drop tasks here</EmptyState>}
              <div className="task-stack">
                {tasks.map((task) => (
                  <article
                    className={`task-card ${selectedTaskId === task.id ? "selected" : ""}`}
                    key={task.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${task.title} task details`}
                    onClick={() => setSelectedTaskId(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedTaskId(task.id);
                    }}
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="task-card-head">
                      <strong>{task.title}</strong>
                      <Badge tone={task.priority}>{task.priority}</Badge>
                    </div>
                    <p>{task.description}</p>
                    <div className="task-meta">
                      {task.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                      {task.blockedReason && <Badge tone="coral">blocked</Badge>}
                      <span className={isTaskOverdue(task) ? "overdue-text" : ""}>{formatShortDate(task.dueDate)}</span>
                    </div>
                    {(task.acceptanceCriteria ?? []).length > 0 && (
                      <div className="task-criteria">{task.acceptanceCriteria?.length} done checks</div>
                    )}
                    <div className="task-card-foot">
                      <span>{getProjectName(state, task.projectId)}</span>
                      <Badge tone={task.source === "agent" ? "blue" : "neutral"}>{task.source}</Badge>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {selectedTask && (
        <TaskEditor
          task={selectedTask}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelectedTaskId(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}
