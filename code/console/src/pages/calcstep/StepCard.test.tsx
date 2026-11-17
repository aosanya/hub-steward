import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { StepCard, type StepCardValue } from "./StepCard";
import type { StepRef } from "./failureChoice";

const words = {
  en: {
    "calcstep.step.title": "This step",
    "calcstep.step.runs": "Who runs it",
    "calcstep.step.runsAgency": "The agency runs it",
    "calcstep.step.runsRole": "A role confirms the figure first",
    "calcstep.step.rolePicker": "Confirming role",
    "calcstep.step.roleHint": "The role must exist in the draft. It sees the figure and can accept it or send it back.",
    "calcstep.step.roleNone": "The draft has no role yet. Add one before a role can confirm.",
    "calcstep.step.failure": "If it cannot work out a result",
    "calcstep.step.failureGoto": "Go to a step",
    "calcstep.step.failureStop": "Stop and tell the person what is wrong",
    "calcstep.step.failurePicker": "Step to go to",
    "calcstep.step.failureHint": "Any step of this workflow except this one. It covers bad inputs and a calculation that fails.",
    "calcstep.step.failureEmpty": "Choose what happens when this step cannot work out a result. The agency cannot be published until every calculating step has a choice.",
    "calcstep.step.failureItself": "A step cannot send its own failure to itself. Choose another step.",
    "calcstep.step.failureUnknown": "The step chosen is no longer in this workflow. Choose another step.",
    "calcstep.step.result": "Result is kept as",
    "calcstep.step.resultName": "Result name",
    "calcstep.step.resultHint": "The posting step and later steps find the result under this name.",
    "calcstep.step.rounding": "Rounding",
    "calcstep.step.roundingDown": "Down",
    "calcstep.step.roundingUp": "Up",
    "calcstep.step.roundingHalfUp": "Half up (default)",
    "calcstep.step.roundingHalfDown": "Half down",
    "calcstep.step.roundingHalfEven": "Half even",
    "calcstep.step.roundingHint": "Applied to the result. Half up is used when none is chosen.",
  },
};

const steps: StepRef[] = [
  { id: "apply", name: "Apply for a loan" },
  { id: "work-out", name: "Work out the monthly payment" },
  { id: "review", name: "Loan officer reviews" },
  { id: "post", name: "Post the payment" },
];

const roles = [
  { id: "officer", name: "Loan officer" },
  { id: "treasurer", name: "Group treasurer" },
];

const base: StepCardValue = { runner: { kind: "agency" }, failure: null, resultName: "Monthly payment", rounding: null };

const show = (value: StepCardValue = base, onChange: (next: StepCardValue) => void = () => {}, over: { roles?: typeof roles } = {}) =>
  render(
    <I18nProvider initial={words}>
      <StepCard stepId="work-out" steps={steps} roles={over.roles ?? roles} value={value} onChange={onChange} />
    </I18nProvider>,
  );

describe("the This step card", () => {
  it("shows the four rows", () => {
    show();
    expect(screen.getByRole("heading", { name: "This step" })).toBeInTheDocument();
    for (const label of ["Who runs it", "If it cannot work out a result", "Result is kept as", "Rounding"])
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
  });

  it("marks the failure choice and the result name as required", () => {
    show();
    expect(screen.getByText("If it cannot work out a result *")).toBeInTheDocument();
    expect(screen.getByText("Result is kept as *")).toBeInTheDocument();
  });

  it("shows no role picker while the agency runs the step", () => {
    show();
    expect(screen.queryByLabelText("Confirming role")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "The agency runs it", pressed: true })).toBeInTheDocument();
  });

  it("shows the role picker and the sentence that the role must exist when a role confirms", () => {
    show({ ...base, runner: { kind: "role", roleId: "officer" } });
    expect(screen.getByLabelText("Confirming role")).toHaveValue("officer");
    expect(screen.getByText("The role must exist in the draft. It sees the figure and can accept it or send it back.")).toBeInTheDocument();
  });

  it("offers every role of the draft in the role picker", () => {
    show({ ...base, runner: { kind: "role", roleId: "officer" } });
    const picker = screen.getByLabelText("Confirming role");
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Loan officer", "Group treasurer"]);
  });

  it("says the draft has no role when a role is asked for and none exists", () => {
    show({ ...base, runner: { kind: "role", roleId: "" } }, () => {}, { roles: [] });
    expect(screen.getByText("The draft has no role yet. Add one before a role can confirm.")).toBeInTheDocument();
  });

  it("reports the choice of a role through onChange, with the first role chosen", async () => {
    const onChange = vi.fn();
    show(base, onChange);
    await userEvent.click(screen.getByRole("button", { name: "A role confirms the figure first" }));
    expect(onChange).toHaveBeenCalledWith({ ...base, runner: { kind: "role", roleId: "officer" } });
  });

  it("reports the choice of the agency through onChange", async () => {
    const onChange = vi.fn();
    show({ ...base, runner: { kind: "role", roleId: "treasurer" } }, onChange);
    await userEvent.click(screen.getByRole("button", { name: "The agency runs it" }));
    expect(onChange).toHaveBeenCalledWith({ ...base, runner: { kind: "agency" } });
  });
});

describe("the failure choice on the card", () => {
  it("shows the red sentence while the choice is empty", () => {
    show();
    expect(
      screen.getByText("Choose what happens when this step cannot work out a result. The agency cannot be published until every calculating step has a choice."),
    ).toBeInTheDocument();
  });

  it("shows no sentence once stop and tell the person is chosen", () => {
    show({ ...base, failure: { kind: "stop" } });
    expect(screen.queryByText(/Choose what happens/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Step to go to")).not.toBeInTheDocument();
  });

  it("shows the step picker with every other step and never the step itself", () => {
    show({ ...base, failure: { kind: "goto", stepId: "review" } });
    const picker = screen.getByLabelText("Step to go to");
    const names = within(picker)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toEqual(["Apply for a loan", "Loan officer reviews", "Post the payment"]);
    expect(names).not.toContain("Work out the monthly payment");
    expect(picker).toHaveValue("review");
  });

  it("shows the sentence that the chosen step must be another one when the choice points at the step itself", () => {
    show({ ...base, failure: { kind: "goto", stepId: "work-out" } });
    expect(screen.getByText("A step cannot send its own failure to itself. Choose another step.")).toBeInTheDocument();
  });

  it("shows the sentence for a step the workflow no longer has", () => {
    show({ ...base, failure: { kind: "goto", stepId: "gone" } });
    expect(screen.getByText("The step chosen is no longer in this workflow. Choose another step.")).toBeInTheDocument();
  });

  it("reports go to a step through onChange with no step chosen yet", async () => {
    const onChange = vi.fn();
    show(base, onChange);
    await userEvent.click(screen.getByRole("button", { name: "Go to a step" }));
    expect(onChange).toHaveBeenCalledWith({ ...base, failure: { kind: "goto", stepId: "" } });
  });

  it("reports the step picked through onChange", async () => {
    const onChange = vi.fn();
    show({ ...base, failure: { kind: "goto", stepId: "" } }, onChange);
    await userEvent.selectOptions(screen.getByLabelText("Step to go to"), "post");
    expect(onChange).toHaveBeenCalledWith({ ...base, failure: { kind: "goto", stepId: "post" } });
  });

  it("reports stop and tell the person through onChange", async () => {
    const onChange = vi.fn();
    show(base, onChange);
    await userEvent.click(screen.getByRole("button", { name: "Stop and tell the person what is wrong" }));
    expect(onChange).toHaveBeenCalledWith({ ...base, failure: { kind: "stop" } });
  });
});

describe("the result name and the rounding on the card", () => {
  it("shows the result name and reports an edit", async () => {
    const onChange = vi.fn();
    show({ ...base, resultName: "" }, onChange);
    await userEvent.type(screen.getByLabelText("Result name"), "P");
    expect(onChange).toHaveBeenLastCalledWith({ ...base, resultName: "P" });
  });

  it("offers the five rounding rules with half up pressed when none is chosen", () => {
    show();
    for (const name of ["Down", "Up", "Half up (default)", "Half down", "Half even"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Half up (default)", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Down", pressed: false })).toBeInTheDocument();
  });

  it("presses the rule that is chosen", () => {
    show({ ...base, rounding: "half-even" });
    expect(screen.getByRole("button", { name: "Half even", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Half up (default)", pressed: false })).toBeInTheDocument();
  });

  it("reports the rule picked through onChange", async () => {
    const onChange = vi.fn();
    show(base, onChange);
    await userEvent.click(screen.getByRole("button", { name: "Down" }));
    expect(onChange).toHaveBeenCalledWith({ ...base, rounding: "down" });
  });
});
