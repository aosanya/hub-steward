import { AgeBubble } from "../ui/AgeBubble";
import { Chip } from "../ui/Chip";
import { TextChip } from "../ui/TextChip";
import { settled, type Issue } from "./api";
import "./backlogs.css";
import { effortKnown } from "./effort";
import { IssuePills } from "./IssuePills";
import { tagsOf } from "./tags";

const idLike = /^[A-Za-z]+-?\d+[A-Za-z]?$/;

const plain = (title: string) => title.replace(/\*\*/g, "").replace(/`/g, "");

const leadingCode = (title: string) => {
  const text = plain(title).trim();
  const at = text.indexOf(" ");
  const first = at === -1 ? text : text.slice(0, at);
  return idLike.test(first) && at !== -1 ? { code: first, rest: text.slice(at + 1) } : { code: "", rest: text };
};

export const titleParts = (title: string, code = "") => {
  const lead = leadingCode(title);
  if (code === "") return lead;
  return lead.code === code || lead.code === "" ? { code, rest: lead.rest } : { code, rest: plain(title).trim() };
};

export function IssueCode({ title, code: own }: { title: string; code?: string }) {
  return <span className="issue-code">{titleParts(title, own).code}</span>;
}

export function IssueName({ title, code: own, full = false }: { title: string; code?: string; full?: boolean }) {
  return <span className={full ? "issue-title full" : "issue-title"}>{titleParts(title, own).rest}</span>;
}

function IssueAge({ issue }: { issue: Issue }) {
  return <AgeBubble created={issue.createdAt} ended={issue.completedAt} closed={settled.has(issue.status)} />;
}

export const openUnlessControl = (open: () => void) => (event: { target: EventTarget }) => {
  if (!(event.target as HTMLElement).closest(".issue-tags button, .actions")) open();
};

type Pills = { onPriority?: (priority: string) => void; onEffort?: (effort: string) => void };

export function IssueTags({ issue, chosen, onTag, extra = [], onPriority, onEffort }: { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; extra?: string[] } & Pills) {
  const tags = tagsOf(issue);
  const facts = extra.filter((fact) => fact !== "");
  return tags.length + facts.length === 0 && !issue.createdAt && !onPriority && !onEffort && !issue.priority && !effortKnown(issue.effort) ? null : (
    <span className="issue-tags">
      {tags.map((tag) => (
        <TextChip key={tag} text={tag} pressed={onTag ? chosen.includes(tag) : undefined} onClick={onTag ? () => onTag(tag) : undefined} />
      ))}
      {facts.map((fact) => (
        <Chip key={fact}>{fact}</Chip>
      ))}
      <IssuePills issue={issue} onPriority={onPriority} onEffort={onEffort} />
      <IssueAge issue={issue} />
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

export function IssueLine({ issue, chosen, onTag, showStep, onPriority, onEffort }: { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; showStep?: boolean } & Pills) {
  const words = [...(issue.mark === "Blocked" || issue.mark === "Sinbin" || issue.mark === "Waiting" ? [{ tag: issue.mark, label: issue.mark }] : []), ...lineWords(issue)];
  const step = showStep ? issue.step : "";
  return words.length === 0 && !step && !issue.createdAt && !onPriority && !onEffort && !issue.priority && !effortKnown(issue.effort) ? null : (
    <span className="issue-tags issue-line">
      {words.map((word) => (
        <TextChip key={word.tag} text={word.label} pressed={onTag ? chosen.includes(word.tag) : undefined} onClick={onTag ? () => onTag(word.tag) : undefined} />
      ))}
      {step ? <TextChip text={step} /> : null}
      <IssuePills issue={issue} onPriority={onPriority} onEffort={onEffort} />
      <IssueAge issue={issue} />
    </span>
  );
}
