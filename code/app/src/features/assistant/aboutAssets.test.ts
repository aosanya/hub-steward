import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const asset: ChatAbout = { kind: "asset", id: "e1", name: "Road roller" };
const order: ChatAbout = { kind: "workorder", id: "t1", name: "Repair the culvert" };

describe("an asset and a work order are subjects of their own", () => {
  it("names each by its own name", () => {
    expect(aboutLabel(asset)).toBe("Road roller");
    expect(aboutLabel(order)).toBe("Repair the culvert");
  });

  it("an asset reads its record, its movements and its finished jobs, scoped to the asset", () => {
    expect(readNamesFor(asset)).toEqual(["assetmanager_asset_read", "assetmanager_movement_list", "taskmanager_task_list"]);
    expect(scopedArgs(asset, "assetmanager_asset_read", {})).toEqual({ assetID: "e1" });
    expect(scopedArgs(asset, "assetmanager_movement_list", {})).toEqual({ asset_id: "e1" });
    expect(scopedArgs(asset, "taskmanager_task_list", { status: "open" })).toEqual({ status: "completed", limit: 500 });
    expect(scopeKeysFor(asset, "assetmanager_asset_read")).toEqual(["assetID"]);
    expect(scopeKeysFor(asset, "assetmanager_movement_list")).toEqual(["asset_id"]);
  });

  it("a work order reads its task and the workers, scoped to the task", () => {
    expect(readNamesFor(order)).toEqual(["taskmanager_task_read", "taskmanager_agent_list"]);
    expect(scopedArgs(order, "taskmanager_task_read", { taskID: "other" })).toEqual({ taskID: "t1" });
    expect(scopeKeysFor(order, "taskmanager_task_read")).toEqual(["taskID"]);
    expect(scopeKeysFor(order, "taskmanager_agent_list")).toEqual([]);
  });

  it("reads nothing about people's bills, holdings or applications", () => {
    for (const about of [asset, order]) {
      for (const tool of ["accounting_bill_list", "digitaltwin_tenure_list", "forms_submission_list_of_person", "actor_get_actor"]) {
        expect(readNamesFor(about)).not.toContain(tool);
      }
    }
  });

  it("gives every read a step word", () => {
    for (const about of [asset, order]) for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
  });

  it("offers Details, Movements and Maintenance history for an asset and Details and Assignee for a work order", () => {
    expect(choicesFor(asset)).toEqual(["Details", "Movements", "Maintenance history"]);
    expect(choicesFor(order)).toEqual(["Details", "Assignee"]);
  });

  it("asks to tap one or write a question, with the choices and the name, and no backlog texts", () => {
    for (const about of [asset, order]) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${aboutLabel(about)}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).toMatch(/never write the same reply twice/i);
      expect(prompt).not.toMatch(/backlog/i);
    }
    expect(promptFor(asset)).toContain("assetmanager_movement_list");
    expect(promptFor(asset)).toMatch(/linked_ref/);
    expect(promptFor(order)).toContain("taskmanager_task_read");
  });

  it("names the subject in the placeholder and the empty state", () => {
    expect(placeholderFor(asset)).toBe("Ask about Road roller");
    expect(emptyWordsFor(asset)).toBe("Ask about Road roller: its details, movements and maintenance history.");
    expect(emptyWordsFor(order)).toBe("Ask about Repair the culvert: its details and assignee.");
  });

  it("reports a refused or missing read, in the subject's own noun", () => {
    expect(readsWordsFor(asset)).toContain("this asset");
    expect(readsWordsFor(order)).toContain("this work order");
  });
});
