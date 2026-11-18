import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const report: ChatAbout = { kind: "report", id: "2026-01-01T00:00:00Z~2026-04-01T00:00:00Z", name: "First quarter" };

describe("the report subject", () => {
  it("reads the report of its own period and lists the reports", () => {
    expect(readNamesFor(report)).toEqual(["accounting_report_read", "accounting_report_list"]);
    expect(scopedArgs(report, "accounting_report_read", {})).toEqual({ period_start: "2026-01-01T00:00:00Z", period_end: "2026-04-01T00:00:00Z" });
    expect(scopeKeysFor(report, "accounting_report_read")).toEqual(["period_start", "period_end"]);
    expect(scopeKeysFor(report, "accounting_report_list")).toEqual([]);
  });

  it("gives every read a step word and names the subject in its own words", () => {
    for (const name of readNamesFor(report)) expect(stepWordsFor(report)[name]).toBeTruthy();
    expect(aboutLabel(report)).toBe("First quarter");
  });

  it("offers its choices and keeps the backlog out of the prompt", () => {
    expect(choicesFor(report)).toEqual(["Figures"]);
    expect(promptFor(report)).toContain("accounting_report_read");
    expect(promptFor(report)).not.toMatch(/backlog/i);
    expect(emptyWordsFor(report)).toContain("First quarter");
  });
});
