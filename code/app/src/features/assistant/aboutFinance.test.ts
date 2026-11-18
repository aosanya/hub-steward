import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

type Case = { about: ChatAbout; reads: string[]; scoped: Record<string, Record<string, string>>; choices: string[]; empty: string };

const cases: Case[] = [
  {
    about: { kind: "bill", id: "b1", name: "Anna Sample" },
    reads: ["accounting_bill_read", "accounting_payment_list"],
    scoped: { accounting_bill_read: { billID: "b1" }, accounting_payment_list: { bill_id: "b1" } },
    choices: ["Details", "Payments"],
    empty: "its details and payments",
  },
  {
    about: { kind: "budget", id: "bl1", name: "Sample Road Repairs" },
    reads: ["accounting_budget_read", "accounting_tender_list"],
    scoped: { accounting_budget_read: { budgetID: "bl1" }, accounting_tender_list: { budget_id: "bl1" } },
    choices: ["Details", "Tenders"],
    empty: "its details and tenders",
  },
  {
    about: { kind: "tender", id: "t2", name: "Printer paper" },
    reads: ["accounting_tender_read", "accounting_quote_list"],
    scoped: { accounting_tender_read: { tenderID: "t2" }, accounting_quote_list: { tenderID: "t2" } },
    choices: ["Details", "Quotes"],
    empty: "its details and quotes",
  },
];

describe.each(cases)("the $about.kind subject", ({ about, reads, scoped, choices, empty }) => {
  it("reads its own record and the list that hangs on it, scoped to its id", () => {
    expect(readNamesFor(about)).toEqual(reads);
    for (const name of reads) {
      expect(scopedArgs(about, name, {})).toEqual(scoped[name]);
      expect(scopeKeysFor(about, name)).toEqual(Object.keys(scoped[name]));
    }
  });

  it("gives every read a step word and names the subject in its own words", () => {
    for (const name of reads) expect(stepWordsFor(about)[name]).toBeTruthy();
    expect(aboutLabel(about)).toBe(about.name);
  });

  it("offers its choices and keeps the backlog out of the prompt", () => {
    expect(choicesFor(about)).toEqual(choices);
    for (const name of reads) expect(promptFor(about)).toContain(name);
    expect(promptFor(about)).not.toMatch(/backlog/i);
    expect(emptyWordsFor(about)).toContain(empty);
  });

  it("never lets a stray id from the model replace the subject's own id", () => {
    const name = reads[0];
    const key = Object.keys(scoped[name])[0];
    expect(scopedArgs(about, name, { [key]: "someone-else" })).toEqual(scoped[name]);
  });
});
