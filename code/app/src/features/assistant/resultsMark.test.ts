import { describe, expect, it } from "vitest";
import { draftOf } from "./results";

const item = (over: Record<string, unknown>) => ({ id: "a", title: "DEV-001 A thing", state: "To do", backlog: "backlog", step: "to-do", priority: "high", tags: ["mwanachama-web"], rank: 1, ...over });

describe("the pill of a pending result", () => {
  it("is Blocked when the hub says the issue is blocked even without a Blocked tag", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({ blocked: true })] })!;
    expect(draft.issues[0].mark).toBe("Blocked");
  });

  it("is Ready for a To do issue that carries the Ready tag", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({ blocked: false, tags: ["mwanachama-web", "Ready"] })] })!;
    expect(draft.issues[0].mark).toBe("Ready");
  });

  it("is no pill for a To do issue with neither the Ready nor the Blocked tag", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({ blocked: false })] })!;
    expect(draft.issues[0].mark).toBe("");
  });

  it("is no pill for a pending issue that is already Doing", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({ blocked: false, state: "Doing" })] })!;
    expect(draft.issues[0].mark).toBe("");
  });

  it("keeps the mark a tag gives, as before", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({ tags: ["x", "Blocked"] })] })!;
    expect(draft.issues[0].mark).toBe("Blocked");
  });

  it("keeps the backlog id of a result row so the panel can name it", () => {
    const draft = draftOf("taskmanager_task_pending", {}, { total: 1, items: [item({})] })!;
    expect(draft.issues[0].backlogId).toBe("backlog");
  });
});
