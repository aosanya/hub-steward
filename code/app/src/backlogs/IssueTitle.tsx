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
  if (!(event.target as HTMLElement).closest(".issue-tags")) open();
};

export function IssueTags({ issue, chosen, onTag }: { issue: Issue; chosen: string[]; onTag: (tag: string) => void }) {
  const tags = tagsOf(issue);
  return tags.length === 0 ? null : (
    <span className="issue-tags">
      {tags.map((tag) => (
        <Chip key={tag} tone={toneOf(tag, issue)} pressed={chosen.includes(tag)} onClick={() => onTag(tag)}>
          {tag}
        </Chip>
      ))}
    </span>
  );
}
