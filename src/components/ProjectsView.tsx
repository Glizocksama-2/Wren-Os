import { Activity, AlertTriangle, CheckCircle2, ExternalLink, Target } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch } from "react";
import { formatRelativeTime, formatShortDate, getProjectNextTask, getProjectSummaries, isTaskOverdue, sortTasksForExecution } from "../store/workspace";
import type { ProjectHealth, ProjectStatus, WorkspaceAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Badge, EmptyState, Panel, ProgressBar } from "./ui";
import { TaskEditor } from "./TaskEditor";

export function ProjectsView({
  state,
  dispatch,
  onNotice
}: {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  onNotice: (message: string) => void;
}) {
  const summaries = getProjectSummaries(state);
  const [selectedId, setSelectedId] = useState(summaries[0]?.id ?? "");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const selected = state.projects.find((project) => project.id === selectedId) ?? state.projects[0];
  const selectedSummary = summaries.find((project) => project.id === selected?.id);
  const selectedTasks = useMemo(
    () => sortTasksForExecution(state.tasks.filter((task) => task.projectId === selected?.id)),
    [selected?.id, state.tasks]
  );
  const nextTask = selected ? getProjectNextTask(state, selected.id) : null;
  const selectedTask = selectedTaskId ? state.tasks.find((task) => task.id === selectedTaskId) : undefined;
  const projectDocs = state.documents.filter((document) => document.projectId === selected?.id);
  const projectActions = state.agentActions.filter((action) => action.projectId === selected?.id);
  const projectSources = state.linkedProjects.filter((source) => source.projectId === selected?.id || source.name === selected?.name);
  const [projectForm, setProjectForm] = useState(() => createProjectForm(selected));

  useEffect(() => {
    setSelectedTaskId(null);
    setEditingProject(false);
    setProjectForm(createProjectForm(selected));
  }, [selected]);

  const saveProject = () => {
    if (!selected) return;
    dispatch({
      type: "project/update",
      id: selected.id,
      payload: {
        name: projectForm.name.trim() || selected.name,
        description: projectForm.description.trim(),
        objective: projectForm.objective.trim(),
        owner: projectForm.owner.trim() || selected.owner,
        status: projectForm.status,
        health: projectForm.health,
        risks: splitList(projectForm.risks),
        tags: splitList(projectForm.tags)
      }
    });
    setEditingProject(false);
    onNotice("Project command page saved.");
  };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Projects</h1>
          <p>Portfolio health, workstream intent, risks, and linked execution.</p>
        </div>
      </div>

      <div className="projects-layout">
        <div className="project-list">
          {summaries.map((project) => (
            <button
              className={`project-tile ${selectedId === project.id ? "selected" : ""}`}
              key={project.id}
              type="button"
              onClick={() => setSelectedId(project.id)}
            >
              <span className="project-accent" style={{ background: project.accent }} />
              <strong>{project.name}</strong>
              <Badge tone={project.health}>{project.health.replace("_", " ")}</Badge>
              <ProgressBar value={project.progress} accent={project.accent} />
              <small>
                {project.completedTasks}/{project.totalTasks} tasks - {project.riskCount} risks
              </small>
            </button>
          ))}
        </div>

        {selected && (
          <Panel className="project-detail">
            <div className="project-command-head">
              <div>
                <div className="detail-kicker">
                  <Activity size={16} />
                  {selected.owner}
                </div>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
              </div>
              <ActionButton onClick={() => setEditingProject((value) => !value)}>
                {editingProject ? "Close edit" : "Edit project"}
              </ActionButton>
            </div>

            {editingProject ? (
              <div className="project-edit-grid">
                <label className="field-stack">
                  <span>Name</span>
                  <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} />
                </label>
                <label className="field-stack">
                  <span>Owner</span>
                  <input value={projectForm.owner} onChange={(event) => setProjectForm({ ...projectForm, owner: event.target.value })} />
                </label>
                <label className="field-stack wide">
                  <span>Description</span>
                  <textarea
                    value={projectForm.description}
                    onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                    rows={3}
                  />
                </label>
                <label className="field-stack wide">
                  <span>Objective</span>
                  <textarea
                    value={projectForm.objective}
                    onChange={(event) => setProjectForm({ ...projectForm, objective: event.target.value })}
                    rows={3}
                  />
                </label>
                <label className="field-stack">
                  <span>Status</span>
                  <select
                    value={projectForm.status}
                    onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value as ProjectStatus })}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
                <label className="field-stack">
                  <span>Health</span>
                  <select
                    value={projectForm.health}
                    onChange={(event) => setProjectForm({ ...projectForm, health: event.target.value as ProjectHealth })}
                  >
                    <option value="on_track">on track</option>
                    <option value="at_risk">at risk</option>
                    <option value="blocked">blocked</option>
                  </select>
                </label>
                <label className="field-stack">
                  <span>Tags</span>
                  <input value={projectForm.tags} onChange={(event) => setProjectForm({ ...projectForm, tags: event.target.value })} />
                </label>
                <label className="field-stack">
                  <span>Risks</span>
                  <input value={projectForm.risks} onChange={(event) => setProjectForm({ ...projectForm, risks: event.target.value })} />
                </label>
                <ActionButton tone="success" onClick={saveProject}>
                  <CheckCircle2 size={16} /> Save project
                </ActionButton>
              </div>
            ) : (
              <>
                <div className="tag-row">
                  {selected.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
                <div className="objective-box">
                  <span>Objective</span>
                  <strong>{selected.objective}</strong>
                </div>
              </>
            )}

            <div className="project-command-grid">
              <div className="project-command-card">
                <span>Progress</span>
                <strong>{selectedSummary?.progress ?? 0}%</strong>
                <ProgressBar value={selectedSummary?.progress ?? 0} accent={selected.accent} />
              </div>
              <div className="project-command-card">
                <span>Ready state</span>
                <strong>{nextTask ? "Ready to move" : "Needs next action"}</strong>
                <small>{selectedSummary?.blockedTaskCount ?? 0} blocked - {selectedSummary?.overdueTaskCount ?? 0} overdue</small>
              </div>
              <div className="project-command-card">
                <span>Review queue</span>
                <strong>{selectedSummary?.reviewTaskCount ?? 0}</strong>
                <small>{projectActions.filter((action) => action.status === "pending").length} agent actions pending</small>
              </div>
            </div>

            <section className="next-action-panel">
              <div>
                <div className="detail-kicker">
                  <Target size={16} />
                  Next Action
                </div>
                {nextTask ? (
                  <>
                    <h3>{nextTask.title}</h3>
                    <p>{nextTask.description}</p>
                    <div className="tag-row">
                      <Badge tone={nextTask.priority}>{nextTask.priority}</Badge>
                      <Badge tone={nextTask.status}>{nextTask.status.replace("_", " ")}</Badge>
                      <span className={isTaskOverdue(nextTask) ? "overdue-text" : ""}>{formatShortDate(nextTask.dueDate)}</span>
                    </div>
                  </>
                ) : (
                  <EmptyState>Create or unblock a task so this project has a clear next move.</EmptyState>
                )}
              </div>
              {nextTask && (
                <ActionButton tone="primary" onClick={() => setSelectedTaskId(nextTask.id)}>
                  Open next action
                </ActionButton>
              )}
            </section>

            <h3>Execution Queue</h3>
            <div className="compact-table">
              {selectedTasks.map((task) => (
                <button className="compact-row button-row" key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)}>
                  <span>{task.title}</span>
                  <Badge tone={task.status}>{task.status.replace("_", " ")}</Badge>
                  <Badge tone={task.priority}>{task.priority}</Badge>
                  {task.blockedReason && <Badge tone="coral">blocked</Badge>}
                </button>
              ))}
              {selectedTasks.length === 0 && <EmptyState>No tasks linked yet</EmptyState>}
            </div>

            <div className="project-intel-grid">
              <section>
                <h3>Knowledge</h3>
                <div className="compact-table">
                  {projectDocs.slice(0, 5).map((document) => (
                    <a className="compact-row button-row" href={document.url} key={document.id}>
                      <span>{document.title}</span>
                      <Badge>{document.kind}</Badge>
                    </a>
                  ))}
                  {projectDocs.length === 0 && <EmptyState>No docs linked yet</EmptyState>}
                </div>
              </section>
              <section>
                <h3>Sources & Agents</h3>
                <div className="compact-table">
                  {projectSources.slice(0, 3).map((source) => (
                    <a className="compact-row button-row" href={source.url} key={source.id}>
                      <span>{source.name}</span>
                      <Badge tone="blue">{source.provider}</Badge>
                      <ExternalLink size={14} />
                    </a>
                  ))}
                  {projectActions.slice(0, 3).map((action) => (
                    <div className="compact-row" key={action.id}>
                      <span>{action.title}</span>
                      <Badge tone={action.status}>{action.status}</Badge>
                      <small>{formatRelativeTime(action.updatedAt)}</small>
                    </div>
                  ))}
                  {projectSources.length === 0 && projectActions.length === 0 && <EmptyState>No source or agent signals yet</EmptyState>}
                </div>
              </section>
            </div>

            {selected.risks.length > 0 && (
              <section className="risk-callout">
                <AlertTriangle size={16} />
                <span>{selected.risks.join(" - ")}</span>
              </section>
            )}
          </Panel>
        )}
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

function createProjectForm(project: WorkspaceState["projects"][number] | undefined) {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    objective: project?.objective ?? "",
    owner: project?.owner ?? "",
    status: project?.status ?? "active",
    health: project?.health ?? "on_track",
    tags: project?.tags.join(", ") ?? "",
    risks: project?.risks.join(", ") ?? ""
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
