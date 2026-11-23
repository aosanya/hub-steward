import type { ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { MessageBox } from "./MessageBox";

export const tryAgainWords = "Try again";

export const loadingWords = "Loading";

export function EmptyCard({ words, children }: { words: string; children?: ReactNode }) {
  return (
    <Card empty>
      <p>{words}</p>
      {children}
    </Card>
  );
}

export function LoadingLine({ words = loadingWords }: { words?: string }) {
  return (
    <Card empty>
      <p role="status">{words}</p>
    </Card>
  );
}

export function LoadFailed({ words, onRetry }: { words: string; onRetry?: () => void }) {
  return (
    <MessageBox words={words}>{onRetry ? <Button onClick={onRetry}>{tryAgainWords}</Button> : null}</MessageBox>
  );
}
