import type { ReactNode } from "react";

type Props = { text: string };

const tokenPattern =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

const highlighted = (pretty: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of pretty.matchAll(tokenPattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(pretty.slice(last, at));
    const [whole, string, colon, word] = match;
    if (string !== undefined && colon !== undefined) {
      parts.push(
        <span key={at} className="json-key">
          {string}
        </span>,
        colon,
      );
    } else if (string !== undefined) {
      parts.push(
        <span key={at} className="json-string">
          {string}
        </span>,
      );
    } else {
      parts.push(
        <span key={at} className={word ? "json-word" : "json-number"}>
          {whole}
        </span>,
      );
    }
    last = at + whole.length;
  }
  if (last < pretty.length) parts.push(pretty.slice(last));
  return parts;
};

const prettyOf = (text: string): string | null => {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object"
      ? JSON.stringify(value, null, 2)
      : null;
  } catch {
    return null;
  }
};

export function JsonView({ text }: Props) {
  const pretty = prettyOf(text);
  return pretty === null ? (
    <span>{text}</span>
  ) : (
    <pre className="json">{highlighted(pretty)}</pre>
  );
}
