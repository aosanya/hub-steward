import { Fragment } from "react";
import { Chip } from "../ui/Chip";
import type { Issue } from "./api";
import "./backlogs.css";
import { tagsOf, toneOf } from "./tags";

const idLike = /^[A-Za-z]+-?\d+[A-Za-z]?$/;

const plain = (title: string) => title.replace(/\*\*/g, "").replace(/`/g, "");

export const titleParts = (title: string) => {
  const text = plain(title).trim();
  const at = text.indexOf(" ");
  const first = at === -1 ? text : text.slice(0, at);
  return idLike.test(first) && at !== -1 ? { code: first, rest: text.slice(at + 1) } : { code: "", rest: text };
};

export function IssueTitle({ title }: { title: string }) {
  const { code, rest } = titleParts(title);
  return (
    <span className="issue-title">
      {code ? <span className="issue-code">{code}</span> : null}
      {code ? " " : null}
      {rest}
    </span>
  );
}

export const openUnlessTag = (open: () => void) => (event: { target: EventTarget }) => {
  if (!(event.target as HTMLElement).closest(".issue-tags button")) open();
};

export function IssueTags({ issue, chosen, onTag, extra = [] }: { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; extra?: string[] }) {
  const tags = tagsOf(issue);
  const facts = extra.filter((fact) => fact !== "");
  return tags.length + facts.length === 0 ? null : (
    <span className="issue-tags">
      {tags.map((tag) => (
        <Chip key={tag} tone={toneOf(tag, issue)} pressed={onTag ? chosen.includes(tag) : undefined} onClick={onTag ? () => onTag(tag) : undefined}>
          {tag}
        </Chip>
      ))}
      {facts.map((fact) => (
        <Chip key={fact}>{fact}</Chip>
      ))}
    </span>
  );
}

const shortRepo = (repo: string) => repo.split("/").pop() ?? repo;

type Word = { tag: string; label: string };

export const lineWords = (issue: Issue): Word[] =>
  [
    { tag: issue.repo, label: shortRepo(issue.repo) },
    { tag: issue.backlog, label: issue.backlog },
  ].filter((word, at, all) => word.label !== "" && all.findIndex((one) => one.label === word.label) === at);

export function IssueLine({ issue, chosen, onTag }: { issue: Issue; chosen: string[]; onTag?: (tag: string) => void }) {
  const blocked = issue.mark === "Blocked";
  const words = lineWords(issue);
  return !blocked && words.length === 0 ? null : (
    <span className="issue-tags issue-line">
      {blocked ? (
        <Chip tone="danger" pressed={onTag ? chosen.includes("Blocked") : undefined} onClick={onTag ? () => onTag("Blocked") : undefined}>
          Blocked
        </Chip>
      ) : null}
      {words.length > 0 ? (
        <span className="issue-words">
          {words.map((word, at) => (
            <Fragment key={word.tag}>
              {at > 0 ? " · " : null}
              {onTag ? (
                <button type="button" className="issue-word" aria-pressed={chosen.includes(word.tag)} onClick={() => onTag(word.tag)}>
                  {word.label}
                </button>
              ) : (
                word.label
              )}
            </Fragment>
          ))}
        </span>
      ) : null}
    </span>
  );
}
