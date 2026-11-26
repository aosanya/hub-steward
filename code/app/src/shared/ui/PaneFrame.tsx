import type { ReactNode } from "react";
import "./paneWindow.css";

type Props = { list: ReactNode; label: string; main?: ReactNode; strip?: boolean };

export function PaneFrame({ list, label, main, strip = true }: Props) {
  return (
    <div className="wf">
      <div className="wf-panes">
        <section className="wf-tree" aria-label={label}>{list}</section>
        <section className="wf-main">{main}</section>
      </div>
      {strip ? <footer className="wf-status" aria-label="Status bar" /> : null}
    </div>
  );
}
