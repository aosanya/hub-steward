import { Icon } from "../../ui/Icon";

export type KeyLine = { text: string; failed: boolean };

export function KeyResult({ line }: { line: KeyLine | null }) {
  return (
    <span className={line?.failed ? "mk-result bad" : "mk-result"} role="status">
      {line && <Icon name={line.failed ? "cross" : "check"} size={16} stroke={2.6} />}
      {line?.text}
    </span>
  );
}
