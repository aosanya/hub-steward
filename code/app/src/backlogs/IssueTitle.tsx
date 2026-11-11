import { Chip } from "../ui/Chip";
import type { Issue } from "./api";
import "./backlogs.css";
import { chipLook, tagsOf } from "./tags";

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
        <Chip key={tag} {...chipLook(tag)} pressed={onTag ? chosen.includes(tag) : undefined} onClick={onTag ? () => onTag(tag) : undefined}>
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
  const words = [...(issue.mark === "Blocked" ? [{ tag: "Blocked", label: "Blocked" }] : []), ...lineWords(issue)];
  return words.length === 0 ? null : (
    <span className="issue-tags issue-line">
      {words.map((word) => (
        <Chip key={word.tag} {...chipLook(word.label)} pressed={onTag ? chosen.includes(word.tag) : undefined} onClick={onTag ? () => onTag(word.tag) : undefined}>
          {word.label}
        </Chip>
      ))}
    </span>
  );
}
