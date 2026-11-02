import type { ReactNode } from "react";
import { Card } from "./Card";

export function EmptyCard({ words, children }: { words: string; children?: ReactNode }) {
  return (
    <Card empty>
      <p>{words}</p>
      {children}
    </Card>
  );
}

export function LoadingLine({ words = "Loading" }: { words?: string }) {
  return (
    <Card empty>
      <p role="status">{words}</p>
    </Card>
  );
}

export function LoadFailed({ words }: { words: string }) {
  return (
    <Card empty>
      <p role="alert">{words}</p>
    </Card>
  );
}
