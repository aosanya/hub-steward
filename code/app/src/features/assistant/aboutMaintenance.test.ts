import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, stepWordsFor } from "./aboutSubjects";

const record: ChatAbout = {
  kind: "maintenance",
  id: "m1",
  name: "Changed the hydraulic oil",
  extra: { owner: "", details: "Asset: Road roller A-12. Date done: 2026-11-12. Kind: Repair. Cost: 18500. Next due: 2027-05-12" },
};

describe("a maintenance record is a subject of its own", () => {
  it("is named by what was done", () => {
    expect(aboutLabel(record)).toBe("Changed the hydraulic oil");
  });

  it("reads no tool: the register has no read of one row, so everything it may say is given in the conversation", () => {
    expect(readNamesFor(record)).toEqual([]);
    expect(stepWordsFor(record)).toEqual({});
  });

  it("offers what was done, when it is next due and what it cost", () => {
    expect(choicesFor(record)).toEqual(["What was done", "When it is next due", "What it cost"]);
  });

  it("gives the details on the page to the model and tells it to answer them without a tool", () => {
    const prompt = promptFor(record);
    expect(prompt).toContain("What is on its page: Asset: Road roller A-12. Date done: 2026-11-12. Kind: Repair. Cost: 18500. Next due: 2027-05-12.");
    expect(prompt).toContain("What would you like to see about Changed the hydraulic oil? Tap one, or write your question.");
    for (const choice of choicesFor(record)) expect(prompt).toContain(`[[${choice}]]`);
    expect(prompt).toMatch(/without a tool/i);
    expect(prompt).not.toMatch(/backlog/i);
  });

  it("never offers a read of other records, assets or people", () => {
    for (const tool of ["agency_list_live_record_rows", "assetmanager_asset_read", "actor_get_actor", "accounting_bill_list", "taskmanager_task_list"]) {
      expect(readNamesFor(record)).not.toContain(tool);
    }
  });

  it("names the subject in the placeholder, the empty state and the refusal words", () => {
    expect(placeholderFor(record)).toBe("Ask about Changed the hydraulic oil");
    expect(emptyWordsFor(record)).toBe("Ask about Changed the hydraulic oil: what was done, when it is next due and what it cost.");
    expect(readsWordsFor(record)).toContain("this maintenance record");
  });
});
