import type { MouseEvent } from "react";
import type { Rule } from "../rulebook";
import { IssueCode, IssueName } from "../shared/IssueTitle";
import { contentsLabel } from "./words";

export const anchorOf = (code: string) => `book-${code}`;

const leavesToBrowser = (event: MouseEvent) => event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

const goTo = (code: string) => (event: MouseEvent) => {
  if (leavesToBrowser(event)) return;
  event.preventDefault();
  const target = document.getElementById(anchorOf(code));
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView();
};

export function BookContents({ rules }: { rules: Rule[] }) {
  return (
    <nav className="book-contents" aria-label={contentsLabel}>
      <ol role="list" aria-label={contentsLabel}>
        {rules.map((rule) => (
          <li key={rule.code}>
            <a href={`#${anchorOf(rule.code)}`} onClick={goTo(rule.code)}>
              <IssueCode title={rule.title} code={rule.code} /> <IssueName title={rule.title} code={rule.code} full />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
