import type { ReactNode } from "react";

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottombar">{children}</div>;
}
