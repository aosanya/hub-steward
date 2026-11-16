import type { ReactNode } from "react";
import "./paneWindow.css";

type Props = { list: ReactNode; label: string; main?: ReactNode };

export function PaneFrame({ list, label, main }: Props) {
  return (
    <div className="wf">
      <div className="wf-panes">
        <section className="wf-tree" aria-label={label}>{list}</section>
        <section className="wf-main">{main}</section>
      </div>
      <footer className="wf-status" aria-label="Status bar" />
    </div>
  );
}
