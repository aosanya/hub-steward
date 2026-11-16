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

describe("the approval limit on a step", () => {
  it("carries the amount", () => {
    expect(memberStepOf(raw({ approval_limit: { amount: 500000 } }))?.approvalLimit).toEqual({ amount: 500000 });
  });

  it("carries a limit without an amount", () => {
    expect(memberStepOf(raw({ approval_limit: {} }))?.approvalLimit).toEqual({});
  });

  it("drops an amount that is not a finite number", () => {
    expect(memberStepOf(raw({ approval_limit: { amount: "500000" } }))?.approvalLimit).toEqual({});
  });

  it("has none when the step does not check", () => {
    expect(memberStepOf(raw())?.approvalLimit).toBeUndefined();
  });

  it("has none when the key is not an object", () => {
    expect(memberStepOf(raw({ approval_limit: 5 }))?.approvalLimit).toBeUndefined();
  });
});
