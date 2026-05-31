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
