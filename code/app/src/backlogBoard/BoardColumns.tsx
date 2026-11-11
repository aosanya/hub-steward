import type { ReactNode } from "react";
import type { Issue } from "../backlogs/api";
import type { Column } from "./board";
import "./backlogBoard.css";

type Props = { columns: Column[]; renderCard: (issue: Issue) => ReactNode };

export function BoardColumns({ columns, renderCard }: Props) {
  return (
    <div className="bb-board">
      {columns.map((column) => (
        <section key={column.step} className="bb-col" aria-label={column.step}>
          <h3>
            <span>{column.step}</span>
            <span>{column.issues.length}</span>
          </h3>
          {column.issues.map((issue) => (
            <div key={issue.id} className="bb-card">
              {renderCard(issue)}
            </div>
          ))}
          {column.issues.length === 0 ? <p className="bb-none">Nothing here</p> : null}
        </section>
      ))}
    </div>
  );
}
