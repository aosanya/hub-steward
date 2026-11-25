import { describe, expect, it } from "vitest";
import * as rulebook from "./words";

const sentencesOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return sentencesOf((value as (...args: unknown[]) => unknown)("R-1", "25 Nov 2026"));
  if (value && typeof value === "object") return Object.values(value).flatMap(sentencesOf);
  return [];
};

describe("the words of the rulebook screens", () => {
  it("has no blank word and no word padded with spaces", () => {
    const sentences = Object.entries(rulebook)
      .filter(([name]) => name !== "countWords")
      .flatMap(([, value]) => sentencesOf(value));
    expect(sentences.length).toBeGreaterThan(30);
    expect(sentences.filter((sentence) => sentence !== sentence.trim() || sentence.trim() === "")).toEqual([]);
  });

  it("names the three choices of the switch", () => {
    expect(rulebook.viewWords).toEqual({ rules: "Rules", decisions: "Decisions", questions: "Questions" });
  });

  it("names a record by its kind", () => {
    expect(rulebook.kindTitle).toEqual({ rule: "Rule", decision: "Decision", question: "Question" });
  });

  it("counts each kind with one form for 1 and one for the rest", () => {
    expect(rulebook.countWords("rule", 1)).toBe("1 rule");
    expect(rulebook.countWords("rule", 5)).toBe("5 rules");
    expect(rulebook.countWords("decision", 1)).toBe("1 decision");
    expect(rulebook.countWords("decision", 0)).toBe("0 decisions");
    expect(rulebook.countWords("question", 1)).toBe("1 question");
    expect(rulebook.countWords("question", 3)).toBe("3 questions");
  });

  it("names the statuses of each kind and no others", () => {
    expect(rulebook.statusWords.rule).toEqual({ proposed: "Proposed", in_force: "In force", superseded: "Superseded", retired: "Retired" });
    expect(rulebook.statusWords.decision).toEqual({ proposed: "Proposed", decided: "Decided", superseded: "Superseded" });
    expect(rulebook.statusWords.question).toEqual({ open: "Open", answered: "Answered", dropped: "Dropped" });
  });

  it("says what replaced a superseded record and that a retired one has no replacement", () => {
    expect(rulebook.supersededByWords("R-1")).toBe("Superseded by R-1");
    expect("retiredWords" in rulebook).toBe(false);
    expect(rulebook.replacesWords("R-6")).toBe("Replaces R-6.");
    expect(rulebook.replacesWords("")).toBe("Replaces nothing.");
    expect(rulebook.replacedByWords("D-4")).toBe("Replaced by D-4.");
    expect(rulebook.replacedByWords("")).toBe("Replaced by nothing.");
  });

  it("has an empty line for each kind, in the words of a backlog", () => {
    expect(rulebook.emptyWords).toEqual({
      rule: "No rules bear on this backlog yet.",
      decision: "No decisions bear on this backlog yet.",
      question: "No questions bear on this backlog yet.",
    });
    expect(rulebook.noMatchWords).toBe("Nothing at this status");
  });

  it("heads the reason of a question differently from the reason of a rule or decision", () => {
    expect(rulebook.whyHeading).toEqual({ rule: "Why", decision: "Why", question: "Why it is asked" });
  });

  it("names who decided and when, and drops the date when there is none", () => {
    expect(rulebook.decidedByWords("Owner", "25 Nov 2026")).toBe("Decided by Owner, 25 Nov 2026");
    expect(rulebook.decidedByWords("owner", "")).toBe("Decided by owner");
  });

  it("names the parts of a record", () => {
    expect(rulebook.goodExampleWords).toBe("Good example");
    expect(rulebook.fileMissingWords).toBe("Not found on main");
    expect(rulebook.issuesHeading).toBe("Issues that follow it");
    expect(rulebook.producedHeading).toBe("Rules it produced");
    expect(rulebook.settledInWords).toBe("Settled in");
    expect(rulebook.answeredByWords).toBe("Answered by");
    expect(rulebook.notAnsweredWords).toBe("Not answered yet");
  });

  it("words the search and the nothing-found line", () => {
    expect(rulebook.searchWords).toEqual({ rule: "Search rules", decision: "Search decisions", question: "Search questions" });
    expect(rulebook.noSearchMatchWords).toBe("Nothing matches the search");
  });

  it("names the columns of the list", () => {
    expect(rulebook.columnWords).toEqual({ code: "Code", title: "Title", status: "Status", tags: "Tags" });
  });

  it("names the rows of the details and the card of references", () => {
    expect(rulebook.rowWords).toEqual({ status: "Status", tags: "Tags", priority: "Priority", decided: "Decided" });
    expect(rulebook.referencesHeading).toBe("References");
    expect(rulebook.detailsHeading).toBe("Details");
    expect(rulebook.repoLineWords("hub-steward")).toBe("hub-steward · main");
    expect(rulebook.missingRecordWords).toBe("Nothing has this code.");
  });

  it("gives the no-access card the shape of the Backlogs no-role card and never mentions Notes", () => {
    expect(rulebook.noAccessWords).toBe("You do not have access to the rules yet. Ask the Product owner.");
    expect(Object.keys(rulebook).filter((name) => /note/i.test(name))).toEqual([]);
  });

  it("has a failure line for the list and one for a record", () => {
    expect(rulebook.loadFailedWords).toEqual({ list: "The rules could not be loaded.", record: "This could not be opened." });
  });

  it("keeps the kind order of the switch", () => {
    expect("rulebookKinds" in rulebook).toBe(false);
    expect("RulebookKind" in rulebook).toBe(false);
  });
});
