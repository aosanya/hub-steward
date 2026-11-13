import { useMemo } from "react";
import type { Language } from "./extensions";
import { highlight } from "./highlight";

export function CodeBlock({ source, language }: { source: string; language: Language }) {
  const lines = useMemo(() => highlight(source, language), [source, language]);
  return (
    <div className="code-view">
      <div className="code-scroll">
        {lines.map((tokens, index) => (
          <div className="code-line" key={index}>
            <span className="code-no">{index + 1}</span>
            {tokens.map((token, position) =>
              token.kind === "plain" ? (
                token.text
              ) : (
                <span className={`tok tok-${token.kind}`} key={position}>
                  {token.text}
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
