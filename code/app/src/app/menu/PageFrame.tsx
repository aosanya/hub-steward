import type { ReactNode } from "react";

type Props = { title: string; line?: string; children: ReactNode };

export function PageFrame({ title, line, children }: Props) {
  return (
    <div className="person-page">
      <div className="title-block">
        <h1 className="person-name">{title}</h1>
        {line ? <p className="quiet-line">{line}</p> : null}
      </div>
      <div className="sections">{children}</div>
    </div>
  );
}
