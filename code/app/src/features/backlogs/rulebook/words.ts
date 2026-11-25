import type { RuleKind } from "./types";

export const viewWords = { rules: "Rules", decisions: "Decisions", questions: "Questions" };

export const kindTitle: Record<RuleKind, string> = { rule: "Rule", decision: "Decision", question: "Question" };

const kindNouns: Record<RuleKind, [string, string]> = { rule: ["rule", "rules"], decision: ["decision", "decisions"], question: ["question", "questions"] };

export const countWords = (kind: RuleKind, n: number) => `${n} ${kindNouns[kind][n === 1 ? 0 : 1]}`;

export const statusWords = {
  rule: { proposed: "Proposed", in_force: "In force", superseded: "Superseded", retired: "Retired" },
  decision: { proposed: "Proposed", decided: "Decided", superseded: "Superseded" },
  question: { open: "Open", answered: "Answered", dropped: "Dropped" },
};

export const supersededByWords = (code: string) => `Superseded by ${code}`;

export const replacesWords = (code: string) => (code === "" ? "Replaces nothing." : `Replaces ${code}.`);

export const replacedByWords = (code: string) => (code === "" ? "Replaced by nothing." : `Replaced by ${code}.`);

export const emptyWords: Record<RuleKind, string> = {
  rule: "No rules bear on this backlog yet.",
  decision: "No decisions bear on this backlog yet.",
  question: "No questions bear on this backlog yet.",
};

export const searchWords: Record<RuleKind, string> = { rule: "Search rules", decision: "Search decisions", question: "Search questions" };

export const noSearchMatchWords = "Nothing matches the search";

export const noMatchWords = "Nothing at this status";

export const whyHeading: Record<RuleKind, string> = { rule: "Why", decision: "Why", question: "Why it is asked" };

export const decidedByWords = (name: string, date: string) => (date === "" ? `Decided by ${name}` : `Decided by ${name}, ${date}`);

export const goodExampleWords = "Good example";

export const fileMissingWords = "Not found on main";

export const issuesHeading = "Issues that follow it";

export const producedHeading = "Rules it produced";

export const settledInWords = "Settled in";

export const answeredByWords = "Answered by";

export const notAnsweredWords = "Not answered yet";

export const columnWords = { code: "Code", title: "Title", status: "Status", tags: "Tags" };

export const rowWords = { status: "Status", tags: "Tags", priority: "Priority", decided: "Decided" };

export const detailsHeading = "Details";

export const referencesHeading = "References";

export const repoLineWords = (repo: string) => `${repo} · main`;

export const missingRecordWords = "Nothing has this code.";

export const noAccessWords = "You do not have access to the rules yet. Ask the Product owner.";

export const loadFailedWords = { list: "The rules could not be loaded.", record: "This could not be opened." };
