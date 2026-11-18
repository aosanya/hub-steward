import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const about: ChatAbout = { kind: "rounds", id: "g-mal", name: "Malomsor" };

const reads = ["forms_form_list", "forms_propagation_list", "forms_submission_list", "actor_get_group_population"];

describe("the rounds subject", () => {
  it("reads the rounds, who they reached, who answered and the population, with the neighbourhood's id on the population only", () => {
    expect(readNamesFor(about)).toEqual(reads);
    expect(scopedArgs(about, "actor_get_group_population", {})).toEqual({ group_id: "g-mal" });
    expect(scopeKeysFor(about, "actor_get_group_population")).toEqual(["group_id"]);
    expect(scopedArgs(about, "forms_propagation_list", { form_id: "f1" })).toEqual({ form_id: "f1" });
  });

  it("never lets a stray id from the model replace the neighbourhood's own id", () => {
    expect(scopedArgs(about, "actor_get_group_population", { group_id: "someone-else" })).toEqual({ group_id: "g-mal" });
  });

  it("gives every read a step word and names the neighbourhood in its own words", () => {
    for (const name of reads) expect(stepWordsFor(about)[name]).toBeTruthy();
    expect(aboutLabel(about)).toBe("Malomsor");
  });

  it("offers its choices and keeps the backlog out of the prompt", () => {
    expect(choicesFor(about)).toEqual(["Rounds asked", "Who answered", "Population"]);
    for (const name of reads) expect(promptFor(about)).toContain(name);
    expect(promptFor(about)).not.toMatch(/backlog/i);
    expect(emptyWordsFor(about)).toContain("rounds asked, who answered and the population");
  });
});
