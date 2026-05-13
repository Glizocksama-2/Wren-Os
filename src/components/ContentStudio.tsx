import { Calendar } from "lucide-react";
import { formatShortDate } from "../store/workspace";
import type { ContentStage, WorkspaceState } from "../types/workspace";
import { Badge, EmptyState } from "./ui";

const stages: ContentStage[] = ["idea", "draft", "review", "scheduled", "published"];

export function ContentStudio({ state }: { state: WorkspaceState }) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Content Studio</h1>
          <p>Founder-led publishing pipeline for launches, proof of work, and client education.</p>
        </div>
      </div>
      <div className="content-board">
        {stages.map((stage) => {
          const items = state.contentItems.filter((item) => item.stage === stage).slice(0, 6);
          return (
            <section className="content-column" key={stage}>
              <div className="board-head">
                <h2>{stage}</h2>
                <Badge tone={stage}>{state.contentItems.filter((item) => item.stage === stage).length}</Badge>
              </div>
              {items.length === 0 && <EmptyState>No items</EmptyState>}
              {items.map((item) => (
                <article className="content-card" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.platform}</p>
                  <div className="task-meta">
                    {item.scheduledFor && (
                      <span>
                        <Calendar size={13} /> {formatShortDate(item.scheduledFor)}
                      </span>
                    )}
                    {item.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
