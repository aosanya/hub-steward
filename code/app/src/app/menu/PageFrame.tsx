import type { ReactNode } from "react";

type Props = { title: string; line?: string; actions?: ReactNode; children: ReactNode };

export function PageFrame({ title, line, actions, children }: Props) {
  return (
    <div className="person-page">
      {actions}
      <div className="title-block">
        <h1 className="person-name">{title}</h1>
        {line ? <p className="quiet-line">{line}</p> : null}
      </div>
      <div className="sections">{children}</div>
    </div>
  );
}
