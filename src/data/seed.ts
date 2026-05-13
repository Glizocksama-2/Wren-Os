import type { WorkspaceState } from "../types/workspace";

const now = new Date();
const isoOffset = (days: number, hours = 0) =>
  new Date(now.getTime() + days * 86_400_000 + hours * 3_600_000).toISOString();

const workspaceId = "ws-brian-ops";

export const seedWorkspace: WorkspaceState = {
  workspace: {
    id: workspaceId,
    name: "Mercer Ventures",
    owner: "Alex Mercer",
    mode: "local-first",
    schemaVersion: 4,
    version: "1.0.0",
    agentKey: "wren_sk_local_7f3a9c2e1b8d4f6a0e5c3b7d9a2f4e8c",
    createdAt: isoOffset(-21),
    updatedAt: now.toISOString()
  },
  codexBridge: {
    status: "connected",
    workspacePath: "C:\\Users\\trapc\\Documents\\New project 3",
    repo: "Glizocksama-2/Wren-Os",
    branch: "codex/wren-os-rebuild",
    model: "GPT-5 Codex",
    handoffMode: "copy_prompt",
    lastSyncAt: now.toISOString(),
    lastHandoff: null
  },
  obsidianVault: {
    status: "unlinked",
    name: null,
    noteCount: 0,
    projectCount: 0,
    taskCount: 0,
    documentCount: 0,
    lastSyncedAt: null,
    autoSync: false,
    syncIntervalSeconds: 60,
    lastError: null
  },
  projectSources: [
    {
      provider: "github",
      status: "unlinked",
      name: "GitHub",
      projectCount: 0,
      issueCount: 0,
      deploymentCount: 0,
      lastSyncedAt: null,
      lastError: null
    },
    {
      provider: "vercel",
      status: "unlinked",
      name: "Vercel",
      projectCount: 0,
      issueCount: 0,
      deploymentCount: 0,
      lastSyncedAt: null,
      lastError: null
    }
  ],
  linkedProjects: [],
  projects: [
    {
      id: "p-wren",
      workspaceId,
      name: "Wren OS",
      description: "Local-first AI command center for tasks, agents, automations, knowledge, and APIs.",
      status: "active",
      health: "at_risk",
      accent: "#0f766e",
      owner: "Alex Mercer",
      objective: "Ship the rebuilt command center and prepare a hosted beta.",
      tags: ["product", "ai", "ops"],
      risks: ["Prototype has no backend contract yet."],
      createdAt: isoOffset(-14),
      updatedAt: isoOffset(0)
    },
    {
      id: "p-saka",
      workspaceId,
      name: "Saka Wera",
      description: "Automated job search service for Kenyan job seekers.",
      status: "active",
      health: "on_track",
      accent: "#2563eb",
      owner: "Alex Mercer",
      objective: "Increase job ingestion coverage and close payment integration.",
      tags: ["jobs", "automation", "kenya"],
      risks: [],
      createdAt: isoOffset(-30),
      updatedAt: isoOffset(-1)
    },
    {
      id: "p-content",
      workspaceId,
      name: "Content Engine",
      description: "Content pipeline for founder updates, launch notes, and service positioning.",
      status: "active",
      health: "at_risk",
      accent: "#d97706",
      owner: "Alex Mercer",
      objective: "Publish useful proof of work without slowing delivery.",
      tags: ["content", "distribution"],
      risks: ["Draft velocity dipped below weekly target."],
      createdAt: isoOffset(-18),
      updatedAt: isoOffset(-2)
    },
    {
      id: "p-freelance",
      workspaceId,
      name: "Freelance Pipeline",
      description: "Lead sourcing, proposals, follow-ups, and delivery workflow.",
      status: "active",
      health: "on_track",
      accent: "#475569",
      owner: "Alex Mercer",
      objective: "Turn automation work into repeatable client offers.",
      tags: ["sales", "services"],
      risks: [],
      createdAt: isoOffset(-11),
      updatedAt: isoOffset(-1)
    },
    {
      id: "p-ops",
      workspaceId,
      name: "Ops Automation",
      description: "Monitoring, reminders, inbox triage, and infrastructure watch loops.",
      status: "active",
      health: "on_track",
      accent: "#16a34a",
      owner: "Alex Mercer",
      objective: "Keep important systems watched without manual babysitting.",
      tags: ["automation", "monitoring"],
      risks: [],
      createdAt: isoOffset(-9),
      updatedAt: isoOffset(0)
    }
  ],
  tasks: [
    {
      id: "t-wren-shell",
      workspaceId,
      title: "Rebuild Wren OS app shell",
      description: "Turn the single component prototype into a Vite React app with navigable product surfaces.",
      status: "done",
      priority: "high",
      dueDate: isoOffset(-1),
      tags: ["wren-os", "frontend"],
      projectId: "p-wren",
      source: "agent",
      externalLinks: [],
      createdAt: isoOffset(-5),
      updatedAt: isoOffset(-1)
    },
    {
      id: "t-wren-local-state",
      workspaceId,
      title: "Add local-first workspace persistence",
      description: "Persist tasks, actions, content, docs, and API status to localStorage with import/export.",
      status: "in_progress",
      priority: "critical",
      dueDate: isoOffset(-1),
      tags: ["wren-os", "state"],
      projectId: "p-wren",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-4),
      updatedAt: isoOffset(-1)
    },
    {
      id: "t-wren-api-studio",
      workspaceId,
      title: "Document agent API and webhook contract",
      description: "Expose key endpoints, response shapes, events, and local integration commands.",
      status: "review",
      priority: "medium",
      dueDate: isoOffset(2),
      tags: ["wren-os", "api"],
      projectId: "p-wren",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-3),
      updatedAt: isoOffset(0)
    },
    {
      id: "t-wren-inbox",
      workspaceId,
      title: "Design agent approval inbox",
      description: "Create an inbox for proposed code, content, automation, and sales actions.",
      status: "todo",
      priority: "high",
      dueDate: isoOffset(3),
      tags: ["wren-os", "agents"],
      projectId: "p-wren",
      source: "agent",
      externalLinks: [],
      createdAt: isoOffset(-2),
      updatedAt: isoOffset(-1)
    },
    {
      id: "t-webhook",
      workspaceId,
      title: "Set up n8n webhook for Saka Wera job ingestion",
      description: "Configure incoming webhook node and map payload fields to the job schema.",
      status: "in_progress",
      priority: "high",
      dueDate: isoOffset(1),
      tags: ["n8n", "saka-wera"],
      projectId: "p-saka",
      source: "agent",
      externalLinks: ["https://github.com/Glizocksama-2/Saka-Wera"],
      createdAt: isoOffset(-7),
      updatedAt: isoOffset(0)
    },
    {
      id: "t-payments",
      workspaceId,
      title: "Integrate Pesapal payment gateway",
      description: "Add payment flow to Saka Wera landing page and handle IPN callbacks.",
      status: "todo",
      priority: "high",
      dueDate: isoOffset(4),
      tags: ["payments", "saka-wera"],
      projectId: "p-saka",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-6),
      updatedAt: isoOffset(-1)
    },
    {
      id: "t-job-boards",
      workspaceId,
      title: "Research Kenyan job boards for expansion",
      description: "Identify five additional boards beyond BrighterMonday and MyJobMag.",
      status: "done",
      priority: "low",
      dueDate: null,
      tags: ["research", "saka-wera"],
      projectId: "p-saka",
      source: "agent",
      externalLinks: [],
      createdAt: isoOffset(-10),
      updatedAt: isoOffset(-2)
    },
    {
      id: "t-content-calendar",
      workspaceId,
      title: "Refill launch content calendar",
      description: "Move founder notes into the content pipeline and schedule the strongest pieces.",
      status: "todo",
      priority: "medium",
      dueDate: isoOffset(-2),
      tags: ["content", "launch"],
      projectId: "p-content",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-8),
      updatedAt: isoOffset(-2)
    },
    {
      id: "t-fiverr",
      workspaceId,
      title: "Write Fiverr gig description for automation services",
      description: "Draft three tiers: basic scraper, advanced workflow, full automation stack.",
      status: "todo",
      priority: "medium",
      dueDate: isoOffset(2),
      tags: ["fiverr", "freelance"],
      projectId: "p-freelance",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-3),
      updatedAt: isoOffset(-1)
    },
    {
      id: "t-openclaw",
      workspaceId,
      title: "Configure OpenClaw Guardian automation",
      description: "Set up a 30-minute email, calendar, and infrastructure monitoring loop.",
      status: "done",
      priority: "high",
      dueDate: null,
      tags: ["openclaw", "automation"],
      projectId: "p-ops",
      source: "manual",
      externalLinks: [],
      createdAt: isoOffset(-12),
      updatedAt: isoOffset(-5)
    }
  ],
  agentActions: [
    {
      id: "aa-pricing-refactor",
      workspaceId,
      title: "Refactor pricing page components",
      summary: "Extract shared pricing components, improve data fetching, and prepare a staging preview.",
      agent: "Frontend Agent",
      projectId: "p-wren",
      status: "pending",
      confidence: 0.87,
      trigger: "Code change detected",
      files: [
        { path: "src/pages/PricingPage.tsx", additions: 124, deletions: 38 },
        { path: "src/components/PriceCard.tsx", additions: 89, deletions: 22 },
        { path: "src/hooks/usePlans.ts", additions: 45, deletions: 10 }
      ],
      suggestedNextSteps: ["Run full test suite", "Preview changes", "Deploy to staging"],
      createdAt: isoOffset(0, -2),
      updatedAt: isoOffset(0, -2)
    },
    {
      id: "aa-copy-draft",
      workspaceId,
      title: "Draft 3 blog post concepts",
      summary: "Generate content angles from recent product work and map each to a platform.",
      agent: "Content Strategist",
      projectId: "p-content",
      status: "pending",
      confidence: 0.74,
      trigger: "Weekly content gap",
      files: [{ path: "content/ideas/wren-os-launch.md", additions: 63, deletions: 0 }],
      suggestedNextSteps: ["Pick strongest angle", "Assign review date", "Schedule LinkedIn version"],
      createdAt: isoOffset(0, -1),
      updatedAt: isoOffset(0, -1)
    },
    {
      id: "aa-investor-outline",
      workspaceId,
      title: "Create investor update deck outline",
      summary: "Turn project progress and metrics into a concise update outline.",
      agent: "Deck Builder Agent",
      projectId: "p-freelance",
      status: "pending",
      confidence: 0.81,
      trigger: "Calendar prep",
      files: [{ path: "docs/investor-update-outline.md", additions: 47, deletions: 4 }],
      suggestedNextSteps: ["Review metrics", "Add screenshots", "Export PDF"],
      createdAt: isoOffset(0, -3),
      updatedAt: isoOffset(0, -3)
    },
    {
      id: "aa-lead-scoring",
      workspaceId,
      title: "Update lead scoring rules",
      summary: "Adjust freelance lead scoring based on response quality and budget signals.",
      agent: "Revenue Ops Agent",
      projectId: "p-freelance",
      status: "pending",
      confidence: 0.69,
      trigger: "Pipeline review",
      files: [{ path: "ops/lead-scoring-rules.json", additions: 32, deletions: 19 }],
      suggestedNextSteps: ["Review rule weights", "Backtest on last 20 leads", "Enable automation"],
      createdAt: isoOffset(0, -5),
      updatedAt: isoOffset(0, -5)
    },
    {
      id: "aa-follow-up",
      workspaceId,
      title: "Send follow-up to 12 leads",
      summary: "Prepare tailored follow-up drafts for warm freelance prospects.",
      agent: "Outreach Agent",
      projectId: "p-freelance",
      status: "pending",
      confidence: 0.79,
      trigger: "No reply after 72 hours",
      files: [{ path: "outreach/followups-queued.csv", additions: 12, deletions: 0 }],
      suggestedNextSteps: ["Approve copy", "Send via Gmail", "Log replies"],
      createdAt: isoOffset(0, -6),
      updatedAt: isoOffset(0, -6)
    }
  ],
  automations: [
    {
      id: "auto-standup",
      workspaceId,
      name: "Daily Standup Digest",
      owner: "Ops Agent",
      cadence: "Weekdays 8:30 AM",
      status: "healthy",
      lastRunAt: isoOffset(0, -8),
      nextRunAt: isoOffset(1, -8),
      duration: "1m 12s",
      summary: "Completed successfully"
    },
    {
      id: "auto-leads",
      workspaceId,
      name: "Lead Enrichment Flow",
      owner: "Revenue Ops Agent",
      cadence: "Every 4 hours",
      status: "healthy",
      lastRunAt: isoOffset(0, -4),
      nextRunAt: isoOffset(0, 0),
      duration: "2m 48s",
      summary: "Completed successfully"
    },
    {
      id: "auto-content",
      workspaceId,
      name: "Content Repurposing",
      owner: "Content Agent",
      cadence: "Daily 5:00 PM",
      status: "running",
      lastRunAt: isoOffset(0, -1),
      nextRunAt: isoOffset(1, -1),
      duration: "Running",
      summary: "Rendering platform variants"
    },
    {
      id: "auto-pricing",
      workspaceId,
      name: "Pricing Monitor",
      owner: "Finance Agent",
      cadence: "Every 6 hours",
      status: "warning",
      lastRunAt: isoOffset(0, -6),
      nextRunAt: isoOffset(0, 0),
      duration: "3m 21s",
      summary: "Completed with warnings"
    },
    {
      id: "auto-metrics",
      workspaceId,
      name: "Weekly Metrics Report",
      owner: "Analytics Agent",
      cadence: "Fridays 7:30 AM",
      status: "healthy",
      lastRunAt: isoOffset(-1),
      nextRunAt: isoOffset(6),
      duration: "1m 05s",
      summary: "Completed successfully"
    }
  ],
  contentItems: [
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `content-idea-${index + 1}`,
      workspaceId,
      title: `Founder note idea ${index + 1}`,
      stage: "idea" as const,
      platform: "linkedin" as const,
      owner: "Alex Mercer",
      projectId: index % 2 ? "p-wren" : "p-content",
      scheduledFor: null,
      tags: ["idea", "founder-led"],
      updatedAt: isoOffset(-index)
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `content-draft-${index + 1}`,
      workspaceId,
      title: `Automation proof post ${index + 1}`,
      stage: "draft" as const,
      platform: index % 2 ? ("blog" as const) : ("x" as const),
      owner: "Alex Mercer",
      projectId: "p-content",
      scheduledFor: null,
      tags: ["draft", "automation"],
      updatedAt: isoOffset(-index - 1)
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `content-review-${index + 1}`,
      workspaceId,
      title: `Wren OS launch snippet ${index + 1}`,
      stage: "review" as const,
      platform: "linkedin" as const,
      owner: "Alex Mercer",
      projectId: "p-wren",
      scheduledFor: null,
      tags: ["review", "wren-os"],
      updatedAt: isoOffset(-index - 2)
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `content-scheduled-${index + 1}`,
      workspaceId,
      title: `Service positioning post ${index + 1}`,
      stage: "scheduled" as const,
      platform: "newsletter" as const,
      owner: "Alex Mercer",
      projectId: "p-freelance",
      scheduledFor: isoOffset(index + 1),
      tags: ["scheduled", "services"],
      updatedAt: isoOffset(-index - 3)
    })),
    {
      id: "content-published-1",
      workspaceId,
      title: "What an agent workspace should remember",
      stage: "published",
      platform: "blog",
      owner: "Alex Mercer",
      projectId: "p-wren",
      scheduledFor: isoOffset(-3),
      tags: ["published", "wren-os"],
      updatedAt: isoOffset(-3)
    }
  ],
  documents: [
    {
      id: "doc-framework",
      workspaceId,
      title: "Wren OS Messaging Framework",
      kind: "brief",
      url: "",
      body: "Wren OS is the local-first command center for approving agent work and keeping projects moving.",
      tags: ["wren-os", "messaging"],
      projectId: "p-wren",
      updatedAt: isoOffset(-2)
    },
    {
      id: "doc-pricing",
      workspaceId,
      title: "Pricing Experiment Results",
      kind: "note",
      url: "",
      body: "The strongest response came from outcome-priced automation bundles with a diagnostic entry offer.",
      tags: ["pricing", "freelance"],
      projectId: "p-freelance",
      updatedAt: isoOffset(-3)
    },
    {
      id: "doc-openclaw",
      workspaceId,
      title: "OpenClaw Setup Notes",
      kind: "runbook",
      url: "",
      body: "Gateway mode should stay local. Token auth is required even for loopback sessions.",
      tags: ["openclaw", "automation"],
      projectId: "p-ops",
      updatedAt: isoOffset(-5)
    },
    {
      id: "doc-saka",
      workspaceId,
      title: "Saka Wera Job Source Map",
      kind: "link",
      url: "https://github.com/Glizocksama-2/Saka-Wera",
      body: "Primary boards, scrape cadence, dedupe notes, and source reliability details.",
      tags: ["saka-wera", "jobs"],
      projectId: "p-saka",
      updatedAt: isoOffset(-4)
    }
  ],
  apiProviders: [
    {
      id: "api-stripe",
      workspaceId,
      name: "Stripe",
      category: "Webhooks",
      health: "healthy",
      latencyMs: 120,
      lastCheckedAt: isoOffset(0, -1)
    },
    {
      id: "api-convertkit",
      workspaceId,
      name: "ConvertKit",
      category: "Campaigns",
      health: "healthy",
      latencyMs: 98,
      lastCheckedAt: isoOffset(0, -1)
    },
    {
      id: "api-resend",
      workspaceId,
      name: "Resend",
      category: "Email API",
      health: "healthy",
      latencyMs: 112,
      lastCheckedAt: isoOffset(0, -1)
    },
    {
      id: "api-serp",
      workspaceId,
      name: "SerpAPI",
      category: "Search API",
      health: "warning",
      latencyMs: 412,
      lastCheckedAt: isoOffset(0, -1)
    },
    {
      id: "api-pinecone",
      workspaceId,
      name: "Pinecone",
      category: "Vector DB",
      health: "healthy",
      latencyMs: 87,
      lastCheckedAt: isoOffset(0, -1)
    },
    {
      id: "api-codex",
      workspaceId,
      name: "Codex",
      category: "Local agent bridge",
      health: "healthy",
      latencyMs: 42,
      lastCheckedAt: now.toISOString()
    }
  ],
  apiEndpoints: [
    {
      id: "endpoint-tasks",
      method: "GET",
      path: "/api/tasks",
      description: "List tasks with project, status, priority, and due-date filters.",
      auth: "agent_key",
      example: "curl -H 'Authorization: Bearer wren_sk_...' /api/tasks"
    },
    {
      id: "endpoint-create-task",
      method: "POST",
      path: "/api/tasks",
      description: "Create a task from an agent, automation, or manual integration.",
      auth: "agent_key",
      example: "curl -X POST /api/tasks -d '{\"title\":\"Review deploy\"}'"
    },
    {
      id: "endpoint-actions",
      method: "GET",
      path: "/api/agent-actions",
      description: "Fetch pending action proposals awaiting operator approval.",
      auth: "agent_key",
      example: "curl -H 'Authorization: Bearer wren_sk_...' /api/agent-actions"
    },
    {
      id: "endpoint-decision",
      method: "PATCH",
      path: "/api/agent-actions/:id",
      description: "Approve or deny a proposed agent action.",
      auth: "agent_key",
      example: "curl -X PATCH /api/agent-actions/aa-pricing-refactor -d '{\"status\":\"approved\"}'"
    },
    {
      id: "endpoint-webhook",
      method: "POST",
      path: "/api/events",
      description: "Receive task, automation, content, and deploy events.",
      auth: "agent_key",
      example: "curl -X POST /api/events -d '{\"type\":\"automation.warning\"}'"
    },
    {
      id: "endpoint-codex-handoff",
      method: "POST",
      path: "/api/codex/handoff",
      description: "Future/local contract for creating Codex-ready handoff prompts. Not a live hosted endpoint.",
      auth: "agent_key",
      example: "curl -X POST /api/codex/handoff -d '{\"taskId\":\"t-wren-local-state\"}'"
    }
  ],
  activityEvents: [
    {
      id: "act-1",
      workspaceId,
      entityType: "agent_action",
      entityId: "aa-pricing-refactor",
      eventType: "task_updated",
      message: "Frontend Agent proposed a pricing refactor.",
      payload: {},
      createdAt: isoOffset(0, -2)
    },
    {
      id: "act-2",
      workspaceId,
      entityType: "automation",
      entityId: "auto-pricing",
      eventType: "automation_warning",
      message: "Pricing Monitor completed with warnings.",
      payload: { status: "warning" },
      createdAt: isoOffset(0, -6)
    },
    {
      id: "act-3",
      workspaceId,
      entityType: "task",
      entityId: "t-wren-shell",
      eventType: "task_status_changed",
      message: "Wren OS app shell moved to done.",
      payload: { from: "review", to: "done" },
      createdAt: isoOffset(-1)
    },
    {
      id: "act-4",
      workspaceId,
      entityType: "document",
      entityId: "doc-framework",
      eventType: "document_created",
      message: "Messaging framework was added to the knowledge base.",
      payload: {},
      createdAt: isoOffset(-2)
    }
  ]
};
