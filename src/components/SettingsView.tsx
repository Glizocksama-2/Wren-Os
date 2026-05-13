import {
  Cloud,
  Download,
  FolderOpen,
  Github,
  PlugZap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  Unlink,
  Upload
} from "lucide-react";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { readMarkdownFilesFromDirectory, type LocalDirectoryHandle } from "../store/obsidian";
import { mapGitHubApiRepository, parseProjectSourceImport } from "../store/projectSources";
import { formatRelativeTime, parseWorkspaceImport, serializeWorkspace } from "../store/workspace";
import type { ProjectSourceProvider, WorkspaceAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Panel } from "./ui";

const RESET_CONFIRMATION = "RESET WREN OS";

export function SettingsView({
  state,
  dispatch,
  onNotice
}: {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  onNotice: (message: string) => void;
}) {
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<WorkspaceState | null>(null);
  const [resetPhrase, setResetPhrase] = useState("");
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isVaultSyncing, setIsVaultSyncing] = useState(false);
  const [sourceImportText, setSourceImportText] = useState("");
  const [isGitHubSyncing, setIsGitHubSyncing] = useState(false);
  const vaultHandleRef = useRef<LocalDirectoryHandle | null>(null);
  const supportsFolderPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

  const syncVault = async (handle: LocalDirectoryHandle, silent = false) => {
    setIsVaultSyncing(true);
    try {
      const files = await readMarkdownFilesFromDirectory(handle);
      dispatch({ type: "obsidian/sync", payload: { vaultName: handle.name, files } });
      if (!silent) onNotice("Obsidian vault synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Obsidian sync failed.";
      dispatch({ type: "obsidian/error", error: message });
      if (!silent) onNotice(message);
    } finally {
      setIsVaultSyncing(false);
    }
  };

  useEffect(() => {
    if (!state.obsidianVault.autoSync || !vaultHandleRef.current) return;

    const timer = window.setInterval(() => {
      if (vaultHandleRef.current) void syncVault(vaultHandleRef.current, true);
    }, Math.max(15, state.obsidianVault.syncIntervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [state.obsidianVault.autoSync, state.obsidianVault.syncIntervalSeconds]);

  const exportData = () => {
    const exported = serializeWorkspace(state);
    setImportText(exported);
    setImportPreview(null);

    if (!navigator.clipboard?.writeText) {
      onNotice("Workspace JSON prepared. Clipboard unavailable.");
      return;
    }

    void navigator.clipboard
      .writeText(exported)
      .then(() => onNotice("Workspace JSON prepared and copied."))
      .catch(() => onNotice("Workspace JSON prepared. Clipboard unavailable."));
  };

  const importData = () => {
    const result = parseWorkspaceImport(importText);
    if (!result.ok || !result.workspace) {
      setImportPreview(null);
      onNotice(result.error ?? "Import failed.");
      return;
    }
    setImportPreview(result.workspace);
    onNotice("Workspace import preview ready.");
  };

  const confirmImport = () => {
    if (!importPreview) return;

    dispatch({ type: "workspace/import", payload: importPreview });
    setImportPreview(null);
    setImportText("");
    setIsResetOpen(false);
    setResetPhrase("");
    onNotice("Workspace imported.");
  };

  const requestReset = () => {
    setIsResetOpen(true);
    setResetPhrase("");
    onNotice(`Type ${RESET_CONFIRMATION} to confirm reset.`);
  };

  const confirmReset = () => {
    if (resetPhrase !== RESET_CONFIRMATION) return;

    dispatch({ type: "workspace/reset" });
    setImportText("");
    setImportPreview(null);
    setIsResetOpen(false);
    setResetPhrase("");
    onNotice("Workspace reset.");
  };

  const linkObsidianVault = async () => {
    const picker = (window as Window & {
      showDirectoryPicker?: (options?: { mode?: "read" }) => Promise<LocalDirectoryHandle>;
    }).showDirectoryPicker;

    if (!picker) {
      onNotice("Folder access is not supported in this browser.");
      return;
    }

    try {
      const handle = await picker({ mode: "read" });
      vaultHandleRef.current = handle;
      await syncVault(handle);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onNotice(error instanceof Error ? error.message : "Obsidian folder link failed.");
    }
  };

  const syncCurrentVault = () => {
    if (!vaultHandleRef.current) {
      onNotice("Choose the Obsidian folder again to refresh live data.");
      return;
    }

    void syncVault(vaultHandleRef.current);
  };

  const syncGitHubRepo = async () => {
    const repo = state.codexBridge.repo.trim();

    if (!repo.includes("/")) {
      onNotice("GitHub repo must be owner/name.");
      return;
    }

    setIsGitHubSyncing(true);
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`);
      if (!response.ok) throw new Error(`GitHub public sync hit HTTP ${response.status}. Import a local snapshot from npm run sources:snapshot.`);

      const repository = await response.json();
      dispatch({
        type: "project_sources/sync",
        payload: {
          provider: "github",
          projects: [mapGitHubApiRepository(repository)]
        }
      });
      onNotice("GitHub project source synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub sync failed.";
      dispatch({ type: "project_sources/error", provider: "github", error: message });
      onNotice(message);
    } finally {
      setIsGitHubSyncing(false);
    }
  };

  const importProjectSources = () => {
    const result = parseProjectSourceImport(sourceImportText);
    if (!result.ok || !result.payloads) {
      onNotice(result.error ?? "Project source import failed.");
      return;
    }

    result.payloads.forEach((payload) => dispatch({ type: "project_sources/sync", payload }));
    setSourceImportText("");
    onNotice("Project source snapshot imported.");
  };

  const getSource = (provider: ProjectSourceProvider) =>
    state.projectSources.find((source) => source.provider === provider);

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Settings</h1>
          <p>Workspace identity, local data controls, import/export, and reset.</p>
        </div>
      </div>

      <div className="settings-grid">
        <Panel title="Workspace Profile">
          <div className="settings-profile">
            <label>
              Workspace name
              <input value={state.workspace.name} readOnly />
            </label>
            <label>
              Owner
              <input value={state.workspace.owner} readOnly />
            </label>
            <label>
              Mode
              <input value={state.workspace.mode} readOnly />
            </label>
          </div>
        </Panel>

        <Panel title="Codex Connection">
          <div className="settings-profile codex-settings">
            <div className="settings-status-row">
              <TerminalSquare size={18} />
              <strong>{state.codexBridge.status === "connected" ? "Connected to Codex" : "Disconnected"}</strong>
            </div>
            <label>
              Workspace path
              <input value={state.codexBridge.workspacePath} readOnly />
            </label>
            <label>
              Repository
              <input value={state.codexBridge.repo} readOnly />
            </label>
            <label>
              Branch
              <input value={state.codexBridge.branch} readOnly />
            </label>
            <label>
              Model
              <input value={state.codexBridge.model} readOnly />
            </label>
          </div>
          <div className="settings-actions">
            <ActionButton
              tone="primary"
              onClick={() => {
                dispatch({ type: "codex/connect" });
                onNotice("Codex bridge connected.");
              }}
            >
              <PlugZap size={16} /> Reconnect Codex
            </ActionButton>
          </div>
        </Panel>

        <Panel title="GitHub & Vercel Sources">
          <div className="source-grid">
            {(["github", "vercel"] as const).map((provider) => {
              const source = getSource(provider);
              const Icon = provider === "github" ? Github : Cloud;
              return (
                <div className="source-connection" key={provider}>
                  <div className="settings-status-row">
                    <Icon size={18} />
                    <strong>{provider === "github" ? "GitHub" : "Vercel"}</strong>
                  </div>
                  <div className="vault-stats">
                    <span>{formatCount(source?.projectCount ?? 0, "project")}</span>
                    <span>{formatCount(source?.issueCount ?? 0, "issue")}</span>
                    <span>{formatCount(source?.deploymentCount ?? 0, "deployment")}</span>
                    <span>{source?.lastSyncedAt ? formatRelativeTime(source.lastSyncedAt) : source?.status ?? "unlinked"}</span>
                  </div>
                  {source?.lastError ? <small>{source.lastError}</small> : null}
                </div>
              );
            })}
          </div>
          <div className="settings-actions">
            <ActionButton tone="primary" onClick={() => void syncGitHubRepo()} disabled={isGitHubSyncing}>
              <Github size={16} /> Sync GitHub repo
            </ActionButton>
            <ActionButton onClick={importProjectSources}>
              <Upload size={16} /> Import source snapshot
            </ActionButton>
          </div>
          <textarea
            value={sourceImportText}
            onChange={(event) => setSourceImportText(event.target.value)}
            placeholder="Paste GitHub/Vercel project snapshot JSON here"
          />
          <p className="settings-note">
            Uses public GitHub reads in the browser and local CLI snapshots for private GitHub/Vercel data. No tokens are stored in Wren OS.
          </p>
        </Panel>

        <Panel title="Local Data">
          <div className="settings-actions">
            <ActionButton tone="primary" onClick={exportData}>
              <Download size={16} /> Export JSON
            </ActionButton>
            <ActionButton onClick={importData}>
              <Upload size={16} /> Import JSON
            </ActionButton>
            <ActionButton tone="danger" onClick={requestReset}>
              <RotateCcw size={16} /> Reset seed
            </ActionButton>
          </div>
          <textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setImportPreview(null);
            }}
            placeholder="Paste exported Wren OS JSON here"
          />
          {importPreview ? (
            <div className="import-preview">
              <div>
                <h3>Import Preview</h3>
                <strong>{importPreview.workspace.name}</strong>
                <span>Schema v{importPreview.workspace.schemaVersion}</span>
              </div>
              <div className="import-preview-counts">
                <span>{importPreview.tasks.length} tasks</span>
                <span>{importPreview.agentActions.length} agent actions</span>
                <span>{importPreview.contentItems.length} content items</span>
                <span>{importPreview.documents.length} documents</span>
                <span>{importPreview.apiProviders.length} API providers</span>
              </div>
              <div className="settings-actions compact-actions">
                <ActionButton tone="primary" onClick={confirmImport} ariaLabel={`Confirm import ${importPreview.workspace.name}`}>
                  <Upload size={16} /> Confirm import
                </ActionButton>
                <ActionButton onClick={() => setImportPreview(null)}>Cancel</ActionButton>
              </div>
            </div>
          ) : null}
          {isResetOpen ? (
            <div className="reset-guard">
              <p>Type {RESET_CONFIRMATION} to confirm reset.</p>
              <input
                aria-label="Reset confirmation phrase"
                value={resetPhrase}
                onChange={(event) => setResetPhrase(event.target.value)}
                placeholder={RESET_CONFIRMATION}
              />
              <div className="settings-actions compact-actions">
                <ActionButton tone="danger" onClick={confirmReset} disabled={resetPhrase !== RESET_CONFIRMATION}>
                  <RotateCcw size={16} /> Confirm reset
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setIsResetOpen(false);
                    setResetPhrase("");
                  }}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Data Safety">
          <div className="data-safety-grid">
            <div className="settings-status-row">
              <ShieldCheck size={18} />
              <strong>Browser localStorage</strong>
            </div>
            <div>
              <span>Last saved</span>
              <strong>{formatRelativeTime(state.workspace.updatedAt)}</strong>
            </div>
            <div>
              <span>Storage mode</span>
              <strong>Private local-first</strong>
            </div>
            <div>
              <span>Export reminder</span>
              <strong>Export before switching browsers, profiles, or devices.</strong>
            </div>
          </div>
          <p className="settings-note">Data stays in this browser unless you export it.</p>
        </Panel>

        <Panel title="Obsidian Vault">
          <div className="vault-connection">
            <div className="settings-status-row">
              <FolderOpen size={18} />
              <strong>{state.obsidianVault.name ?? "No vault linked"}</strong>
            </div>
            <p>Folder access needs your approval. Wren OS reads Markdown locally and keeps a local snapshot.</p>
            <div className="vault-stats">
              <span>{state.obsidianVault.noteCount} notes</span>
              <span>{state.obsidianVault.projectCount} projects</span>
              <span>{state.obsidianVault.taskCount} tasks</span>
              <span>{state.obsidianVault.documentCount} docs</span>
            </div>
            {state.obsidianVault.lastSyncedAt ? (
              <small>Last synced {formatRelativeTime(state.obsidianVault.lastSyncedAt)}</small>
            ) : (
              <small>{supportsFolderPicker ? "Ready to link an Obsidian folder." : "Folder picker unavailable in this browser."}</small>
            )}
            <label className="module-toggle vault-toggle">
              <input
                type="checkbox"
                checked={state.obsidianVault.autoSync}
                onChange={(event) => dispatch({ type: "obsidian/configure", payload: { autoSync: event.target.checked } })}
              />
              Auto-sync while open
            </label>
          </div>
          <div className="settings-actions">
            <ActionButton tone="primary" onClick={() => void linkObsidianVault()} disabled={isVaultSyncing}>
              <FolderOpen size={16} /> Link Obsidian folder
            </ActionButton>
            <ActionButton onClick={syncCurrentVault} disabled={isVaultSyncing || !state.obsidianVault.name}>
              <RefreshCw size={16} /> Sync vault
            </ActionButton>
            <ActionButton
              tone="danger"
              onClick={() => {
                vaultHandleRef.current = null;
                dispatch({ type: "obsidian/unlink" });
                onNotice("Obsidian vault unlinked.");
              }}
              disabled={!state.obsidianVault.name}
            >
              <Unlink size={16} /> Unlink vault
            </ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function formatCount(value: number, singular: string): string {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}
