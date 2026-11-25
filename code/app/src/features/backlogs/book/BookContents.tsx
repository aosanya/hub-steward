import { IssueCode, IssueName } from "../shared/IssueTitle";
import type { DatedRule } from "./bookRules";
import { contentsLabel } from "./words";

export const anchorOf = (code: string) => `book-${code}`;

export function BookContents({ rules }: { rules: DatedRule[] }) {
  return (
    <ol className="book-contents" aria-label={contentsLabel}>
      {rules.map((rule) => (
        <li key={rule.code}>
          <a
            href={`#${anchorOf(rule.code)}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(anchorOf(rule.code))?.scrollIntoView();
            }}
          >
            <IssueCode title={rule.title} code={rule.code} /> <IssueName title={rule.title} code={rule.code} full />
          </a>
        </li>
      ))}
    </ol>
  );
}
