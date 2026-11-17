import { describe, expect, it } from "vitest";
import { defaultRounding, failureChoiceProblem, otherSteps, roundingRules, type StepRef } from "./failureChoice";

const steps: StepRef[] = [
  { id: "apply", name: "Apply for a loan" },
  { id: "work-out", name: "Work out the monthly payment" },
  { id: "review", name: "Loan officer reviews" },
  { id: "post", name: "Post the payment" },
];

describe("the steps a failing step may go to", () => {
  it("lists every other step of the workflow in their order", () => {
    expect(otherSteps(steps, "work-out").map((step) => step.id)).toEqual(["apply", "review", "post"]);
  });

  it("never lists the step itself", () => {
    for (const step of steps) expect(otherSteps(steps, step.id).some((other) => other.id === step.id)).toBe(false);
  });

  it("lists nothing when the step is alone in its workflow", () => {
    expect(otherSteps([steps[1]], "work-out")).toEqual([]);
  });
});

describe("the problem with a failure choice", () => {
  it("reports an empty choice", () => {
    expect(failureChoiceProblem(null, steps, "work-out")).toBe("empty");
  });

  it("reports a go-to choice that has no step chosen yet", () => {
    expect(failureChoiceProblem({ kind: "goto", stepId: "" }, steps, "work-out")).toBe("empty");
  });

  it("reports a choice that points at the step itself", () => {
    expect(failureChoiceProblem({ kind: "goto", stepId: "work-out" }, steps, "work-out")).toBe("itself");
  });

  it("reports a choice that points at a step the workflow does not have", () => {
    expect(failureChoiceProblem({ kind: "goto", stepId: "gone" }, steps, "work-out")).toBe("unknown-step");
  });

  it("reports nothing for a step to go to", () => {
    expect(failureChoiceProblem({ kind: "goto", stepId: "review" }, steps, "work-out")).toBeNull();
  });

  it("reports nothing for stop and tell the person", () => {
    expect(failureChoiceProblem({ kind: "stop" }, steps, "work-out")).toBeNull();
  });
});

describe("the rounding rules", () => {
  it("are the five proposed rules in the order the screen shows them", () => {
    expect(roundingRules).toEqual(["down", "up", "half-up", "half-down", "half-even"]);
  });

  it("use half up when none is chosen", () => {
    expect(defaultRounding).toBe("half-up");
  });
});
