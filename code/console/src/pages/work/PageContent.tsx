import type { ReactNode } from "react";

export function PageContent({ children }: { children: ReactNode }) {
  return <div className="content">{children}</div>;
}
