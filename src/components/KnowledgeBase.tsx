import { BookOpen, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "../store/workspace";
import type { WorkspaceState } from "../types/workspace";
import { Badge, Panel } from "./ui";

export function KnowledgeBase({ state }: { state: WorkspaceState }) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Knowledge Base</h1>
          <p>Runbooks, notes, briefs, source maps, and memory that agents can reference.</p>
        </div>
      </div>

      <Panel>
        <div className="knowledge-list">
          {state.documents.map((doc) => (
            <article className="knowledge-item" key={doc.id}>
              <div className="doc-icon">
                <BookOpen size={18} />
              </div>
              <div>
                <h2>{doc.title}</h2>
                <p>{doc.body}</p>
                <div className="tag-row">
                  <Badge tone="neutral">{doc.kind}</Badge>
                  {doc.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
              <span>{formatRelativeTime(doc.updatedAt)}</span>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Open ${doc.title}`}>
                  <ExternalLink size={16} />
                </a>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
