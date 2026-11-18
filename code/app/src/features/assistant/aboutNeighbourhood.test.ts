import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const hood: ChatAbout = { kind: "neighbourhood", id: "Malomsor", name: "Malomsor" };

describe("the neighbourhood subject", () => {
  it("reads only the expense totals by neighbourhood, pinned to the neighbourhood's own dimension", () => {
    expect(readNamesFor(hood)).toEqual(["accounting_dimension_totals"]);
    expect(scopedArgs(hood, "accounting_dimension_totals", {})).toEqual({ key: "neighbourhood", account_type: "expense" });
    expect(scopeKeysFor(hood, "accounting_dimension_totals")).toEqual(["key", "account_type"]);
  });

  it("gives the read a step word and names the subject in its own words", () => {
    for (const name of readNamesFor(hood)) expect(stepWordsFor(hood)[name]).toBeTruthy();
    expect(aboutLabel(hood)).toBe("Malomsor");
  });

  it("offers its choice, tells the model which row is this neighbourhood and keeps the backlog out of the prompt", () => {
    expect(choicesFor(hood)).toEqual(["Spending"]);
    expect(promptFor(hood)).toContain("accounting_dimension_totals");
    expect(promptFor(hood)).toContain("Malomsor");
    expect(promptFor(hood)).not.toMatch(/backlog/i);
    expect(emptyWordsFor(hood)).toContain("Malomsor");
  });
});
