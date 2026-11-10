import { describe, expect, it } from "vitest";
import { objectivesHref, workflowHref } from "./objectivesLinks";

describe("the objectives page's addresses", () => {
  it("opens the list with no target", () => {
    expect(objectivesHref("h1")).toBe("/h/h1/objectives");
  });

  it("opens one objective", () => {
    expect(objectivesHref("h1", { objective: "o1" })).toBe("/h/h1/objectives?objective=o1");
  });

  it("opens one step of an objective", () => {
    expect(objectivesHref("h1", { objective: "o1", step: "s 2" })).toBe("/h/h1/objectives?objective=o1&step=s+2");
  });

  it("opens the add form", () => {
    expect(objectivesHref("h1", { add: "objective" })).toBe("/h/h1/objectives?add=objective");
  });

  it("leaves out an empty objective or step", () => {
    expect(objectivesHref("h1", { objective: "", step: "" })).toBe("/h/h1/objectives");
  });

  it("opens a workflow on the workflows page, its id encoded", () => {
    expect(workflowHref("h1", "w/1")).toBe("/h/h1/workflows?open=w%2F1");
  });
});
