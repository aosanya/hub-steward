import type { ReactNode } from "react";

export function Card({ children, empty = false }: { children: ReactNode; empty?: boolean }) {
  return <section className={empty ? "card empty" : "card"}>{children}</section>;
}
