import { describe, expect, it } from "vitest";
import { memberStepOf } from "./api";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  title: "Approve the permit",
  kind: "fill_form",
  workflow_id: "w1",
  workflow_name: "Permit",
  role_id: "r1",
  role_name: "Director",
  form_name: "Permit",
  record_code: "REC-1",
  state: "start",
  questions: [{ prompt: "Approved", answer_type: "yes_no", required: true }],
  ...over,
});

describe("a step that is an approval", () => {
  it("carries approval true when the step says so", () => {
    expect(memberStepOf(raw({ approval: true }))?.approval).toBe(true);
  });

  it("carries approval false when the step does not say", () => {
    expect(memberStepOf(raw())?.approval).toBe(false);
  });

  it("carries approval false for anything but true", () => {
    expect(memberStepOf(raw({ approval: "true" }))?.approval).toBe(false);
  });
});
