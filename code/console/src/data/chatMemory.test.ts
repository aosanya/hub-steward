import { describe, expect, it } from "vitest";
import { loadTurns, saveTurns } from "./chatMemory";
import type { Turn } from "./modelChat";

const kept: Turn[] = [
  { role: "user", content: "What tools do we have?" },
  {
    role: "assistant",
    content: "Shown.",
    calls: [{ name: "show_my_tools", summary: "", state: "done", ms: 2 }],
    answer: { kind: "tools", prompt: "What tools do we have?", rows: [{ name: "a_b", summary: "Does it.", area: "a" }] },
  },
];

describe("the conversation kept in the browser", () => {
  it("comes back as it was saved, per hub", () => {
    saveTurns("siaya", kept);

    expect(loadTurns("siaya")).toEqual(kept);
    expect(loadTurns("kisumu")).toEqual([]);
  });

  it("keeps a turn whose answer is a filled form", () => {
    const form: Turn[] = [
      { role: "user", content: "Add a cancel workflow" },
      {
        role: "assistant",
        content: "Check it, then press Save.",
        answer: { kind: "form", form: "workflow", prompt: "Add a cancel workflow", fill: { name: "Cancel", description: "", cancel: true, steps: [] } },
      },
    ];
    saveTurns("siaya", form);

    expect(loadTurns("siaya")).toEqual(form);
  });

  it("keeps a turn whose answer is a filled profile", () => {
    const profile: Turn[] = [
      { role: "user", content: "Make the Purpose more general" },
      {
        role: "assistant",
        content: "Check it, then press Save changes.",
        answer: { kind: "form", form: "profile", prompt: "Make the Purpose more general", fill: { name: "", purpose: "Farming of every kind." } },
      },
    ];
    saveTurns("siaya", profile);

    expect(loadTurns("siaya")).toEqual(profile);
  });

  it("keeps a turn whose answer is an action in the content area", () => {
    const action: Turn[] = [
      { role: "user", content: "Raise the daily tokens" },
      {
        role: "assistant",
        content: "Check it, then press Save.",
        answer: { kind: "action", prompt: "Raise the daily tokens", view: "form", title: "Raise", params: { tool: "ai_set_limits", show: ["tokens_per_day"] } },
      },
    ];
    saveTurns("siaya", action);

    expect(loadTurns("siaya")).toEqual(action);
  });

  it("keeps a turn whose answer is a review's suggestions", () => {
    const suggestions: Turn[] = [
      { role: "user", content: "Review the goals" },
      {
        role: "assistant",
        content: "Two things to look at.",
        answer: { kind: "suggestions", prompt: "Review the goals", fill: { page: "goals", summary: "Two things", items: [{ title: "Merge", detail: "Same goal twice", tool: "agency_delete_goal", arguments: {}, then: [] }] } },
      },
    ];
    saveTurns("siaya", suggestions);

    expect(loadTurns("siaya")).toEqual(suggestions);
  });

  it("drops a turn whose action has no view", () => {
    window.localStorage.setItem("chat.turns.siaya", JSON.stringify([{ role: "assistant", content: "x", answer: { kind: "action", prompt: "p", title: "", params: {} } }]));

    expect(loadTurns("siaya")).toEqual([]);
  });

  it("is forgotten when the conversation is empty", () => {
    saveTurns("siaya", kept);
    saveTurns("siaya", []);

    expect(loadTurns("siaya")).toEqual([]);
  });

  it("keeps the latest sixty turns", () => {
    const many: Turn[] = Array.from({ length: 80 }, (_, i) => ({ role: "user", content: `m${i}` }));
    saveTurns("siaya", many);

    const back = loadTurns("siaya");
    expect(back).toHaveLength(60);
    expect(back[0].content).toBe("m20");
  });

  it("drops what is not a turn and survives unreadable storage", () => {
    window.localStorage.setItem("chat.turns.siaya", JSON.stringify([{ role: "system", content: "x" }, { role: "user" }, kept[0], 4]));
    expect(loadTurns("siaya")).toEqual([kept[0]]);

    window.localStorage.setItem("chat.turns.siaya", "{not json");
    expect(loadTurns("siaya")).toEqual([]);
  });
});
