import { ArrowLeft, BrainCircuit, LockKeyhole, Newspaper, ShieldCheck, UsersRound } from "lucide-react";
import logoBoardUrl from "../assets/northwatch-logo-board.png";

type AboutPageProps = {
  isAuthenticated?: boolean;
};

const principles = [
  {
    icon: <LockKeyhole size={18} />,
    title: "Private by default",
    copy: "Each account opens into its own isolated workspace, with team spaces kept separate from personal records."
  },
  {
    icon: <UsersRound size={18} />,
    title: "Built for teams",
    copy: "Team mode adds shared priorities, member roles, invites, notifications, and a cooperative war room view."
  },
  {
    icon: <Newspaper size={18} />,
    title: "Live operating intel",
    copy: "Market, news, weather, workout, finance, and agent signals are pulled through protected backend routes."
  },
  {
    icon: <BrainCircuit size={18} />,
    title: "Agent-aware workflow",
    copy: "Northwatch keeps AI assistance close to the work while preserving human approval, visibility, and context."
  }
];

const operatingLayers = [
  "Capture work in tasks, projects, documents, routines, and content queues.",
  "Switch between personal command and shared team workspaces without mixing data.",
  "Review live intel, financial position, health routines, books, and journal context from the same deck.",
  "Use notifications, invites, role badges, and workspace summaries to keep people aligned."
];

const platformLayers = [
  {
    number: 1,
    title: "Frontend foundations",
    status: "Live",
    copy: "React, Vite, responsive app shell, command modules, auth pages, team pages, and regression tests.",
    proof: "src/App.tsx, src/auth, src/components, src/styles"
  },
  {
    number: 2,
    title: "APIs and backend logic",
    status: "Live",
    copy: "Express routes protect user work, teams, invites, notifications, Intel, weather, workout, Telegram, and system AI.",
    proof: "server/app.js, server/routes"
  },
  {
    number: 3,
    title: "Database and storage",
    status: "Live",
    copy: "PostgreSQL stores accounts, sessions, workspace records, teams, invites, notifications, and rate-limit buckets.",
    proof: "server/db, supabase/migrations"
  },
  {
    number: 4,
    title: "Auth and permission",
    status: "Live",
    copy: "Credential login, httpOnly cookie sessions, team roles, RLS context, and protected route wrappers keep data separated.",
    proof: "server/auth, server/middleware, shared/teamPermissions.js"
  },
  {
    number: 5,
    title: "Hosting and deployment",
    status: "Live",
    copy: "Vercel is the canonical frontend and API host, with rewrites that keep React routes and Express routes separated.",
    proof: "vercel.json, api/[...path].js"
  },
  {
    number: 6,
    title: "Cloud and compute",
    status: "Needs Upgrade",
    copy: "Serverless compute runs the API; pool limits and runbooks define how it behaves under Vercel runtime constraints.",
    proof: "server/db/postgres.js, docs/platform-layers.md"
  },
  {
    number: 7,
    title: "CI/CD and version control",
    status: "Needs Upgrade",
    copy: "GitHub is the source of truth; CI now verifies tests and production builds before changes are merged.",
    proof: ".github/workflows/ci.yml"
  },
  {
    number: 8,
    title: "Security and low level security",
    status: "Needs Upgrade",
    copy: "Helmet, production headers, cookie-only auth, secret hygiene, and dependency checks harden the platform.",
    proof: "server/app.js, vercel.json, docs/platform-layers.md"
  },
  {
    number: 9,
    title: "Rate limiting",
    status: "Live",
    copy: "Postgres-backed API buckets limit auth, team mutations, Intel refresh, and external API-heavy routes.",
    proof: "server/middleware/rateLimit.js"
  },
  {
    number: 10,
    title: "Caching and CDN",
    status: "Live",
    copy: "Static assets use immutable CDN caching; public Intel reads use s-maxage and stale-while-revalidate headers.",
    proof: "vercel.json, server/routes/intel.js"
  },
  {
    number: 11,
    title: "Load balancing and scaling",
    status: "Needs Upgrade",
    copy: "Vercel handles edge routing and serverless scale; Northwatch constrains database connections and documents scaling limits.",
    proof: "vercel.json, server/db/postgres.js"
  },
  {
    number: 12,
    title: "Error tracking and logs",
    status: "Needs Upgrade",
    copy: "Every API response receives a request ID, structured logs are emitted, and Sentry can be enabled through env config.",
    proof: "server/logger.js, server/middleware/requestContext.js"
  },
  {
    number: 13,
    title: "Availability and recovery",
    status: "Needs Upgrade",
    copy: "Health checks, deep database checks, rollback notes, backup verification, and incident runbooks are documented.",
    proof: "server/app.js, docs/platform-layers.md"
  }
];

export function AboutPage({ isAuthenticated = false }: AboutPageProps) {
  return (
    <main className="about-page">
      <nav className="about-nav" aria-label="About page navigation">
        <a href={isAuthenticated ? "/" : "/login"}>
          <ArrowLeft size={16} /> {isAuthenticated ? "Back to dashboard" : "Sign in"}
        </a>
        <a href="/register">Create account</a>
      </nav>

      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="micro-label">About Northwatch</span>
          <h1>A command center for people who run their life, work, teams, and agents from one place.</h1>
          <p>
            Northwatch is a private operating dashboard for tasks, projects, live intel, team coordination, personal records, and AI-assisted execution.
            It is built to make the day visible without letting personal and shared work bleed into each other.
          </p>
          <div className="about-actions">
            <a href={isAuthenticated ? "/" : "/register"}>{isAuthenticated ? "Open dashboard" : "Start with Northwatch"}</a>
            <a href="/login">Sign in</a>
          </div>
        </div>
        <img src={logoBoardUrl} alt="Northwatch logo system board" className="about-logo-board" />
      </section>

      <section className="about-section" aria-labelledby="about-mission-title">
        <div>
          <span className="micro-label">Mission</span>
          <h2 id="about-mission-title">Make operating state clear.</h2>
        </div>
        <p>
          Northwatch is designed around one plain idea: a serious workspace should show what matters, who owns it, what changed, and what needs action next.
          The product keeps high-friction parts of daily operation close together so you can make decisions without rebuilding context every morning.
        </p>
      </section>

      <section className="about-principles" aria-label="Northwatch principles">
        {principles.map((principle) => (
          <article className="about-principle-card" key={principle.title}>
            <span>{principle.icon}</span>
            <h2>{principle.title}</h2>
            <p>{principle.copy}</p>
          </article>
        ))}
      </section>

      <section className="about-platform" aria-labelledby="about-platform-title">
        <div className="about-platform-head">
          <span className="micro-label">Platform foundation</span>
          <h2 id="about-platform-title">Northwatch platform layers</h2>
          <p>
            The product is organized as a full operating stack, from the React workspace down to recovery, logging, scaling, caching, and security controls.
          </p>
        </div>
        <div className="about-layer-grid">
          {platformLayers.map((layer) => (
            <article className="about-layer-card" key={layer.number}>
              <div className="about-layer-meta">
                <span>Layer {layer.number}</span>
                <strong className={`about-layer-status about-layer-status-${layer.status.toLowerCase().replaceAll(" ", "-")}`}>{layer.status}</strong>
              </div>
              <h3>{layer.title}</h3>
              <p>{layer.copy}</p>
              <small>{layer.proof}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="about-system">
        <div className="about-system-panel">
          <span className="micro-label">How it works</span>
          <h2>Personal control, team cooperation, and agent oversight live in one operating loop.</h2>
          <ul>
            {operatingLayers.map((layer) => (
              <li key={layer}>{layer}</li>
            ))}
          </ul>
        </div>
        <div className="about-trust-panel">
          <ShieldCheck size={22} />
          <h2>Trust posture</h2>
          <p>
            Northwatch uses credential login, httpOnly cookie sessions, backend-protected API routes, and role-aware team controls.
            The interface is built to show when data is personal, shared, live, stale, or unavailable.
          </p>
        </div>
      </section>
    </main>
  );
}
