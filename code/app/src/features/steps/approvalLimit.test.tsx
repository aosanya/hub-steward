import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../../routes";
import { memberStepOf, StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent, wasStarted } from "./sent";
import { StepPage } from "./StepPage";

const phoneWidth = 390;
const originalWidth = window.innerWidth;

const resizeTo = (width: number) => {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
};

const amountPrompt = "What amount are you approving, in forints?";

const overLimitSentence = "The amount 720 000 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it.";

const openStepsReply = (limit: Record<string, unknown>) => ({
  id: "WI-56-6",
  title: "The mayor approves the register and the limits",
  kind: "fill_form",
  workflow_name: "Register",
  role_name: "Mayor",
  form_name: "The mayor approves the register and the limits",
  record_code: "REC-56",
  order_id: "o56",
  state: "start",
  approval_limit: limit,
  questions: [
    { prompt: "Did we complete the step?", answer_type: "yes_no", required: true },
    { prompt: amountPrompt, answer_type: "currency", required: true, checks_approval_limit: true },
  ],
});

const mayorStep = (limit: Record<string, unknown>) => memberStepOf(openStepsReply(limit)) as MemberStep;

const show = async (step: MemberStep, submit: StepsClient["submit"]) => {
  const client: StepsClient = { available: async () => [step], submit };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: step.id }, { order: step.orderId })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const fill = async (amount: string) => {
  await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
  await userEvent.type(screen.getByLabelText(amountPrompt), amount);
};

const send = () => userEvent.click(screen.getByRole("button", { name: "Send" }));

beforeEach(() => {
  resizeTo(phoneWidth);
  openAgency("municipality");
});

afterEach(() => {
  cleanup();
  resizeTo(originalWidth);
  forgetOpenAgency();
  forgetSent();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("the mayor's approval step on a phone shows the approval limit", () => {
  it("shows the limit from the open-steps reply in forints", async () => {
    await show(mayorStep({ amount: 500000 }), vi.fn());
    expect(window.innerWidth).toBe(phoneWidth);
    expect(screen.getByText("Your approval limit: 500 000 Ft")).toBeInTheDocument();
  });

  it("says no upper limit is written when the reply carries a limit without an amount", async () => {
    await show(mayorStep({}), vi.fn());
    expect(screen.getByText("No upper limit is written to your role.")).toBeInTheDocument();
    expect(screen.queryByText(/Your approval limit/)).not.toBeInTheDocument();
  });

  it("shows the server's sentence after Send, keeps the typed amount and does not mark the step sent", async () => {
    const step = mayorStep({ amount: 500000 });
    const submit = vi.fn(async () => {
      throw new StepRefused("over-limit", overLimitSentence);
    });
    await show(step, submit);
    await fill("720000");
    await send();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByText(overLimitSentence)).toBeInTheDocument();
    expect(screen.getByLabelText(amountPrompt)).toHaveValue(720000);
    expect(screen.queryByText("elsewhere")).not.toBeInTheDocument();
    expect(wasStarted(step.id)).toBe(false);
  });

  it("sends an amount within the limit without a refusal", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "o56" }));
    await show(mayorStep({ amount: 500000 }), submit);
    await fill("400000");
    await send();

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "WI-56-6", orderId: "o56" }),
      { "Did we complete the step?": "yes", [amountPrompt]: "400000" },
      expect.any(String),
    );
    expect(screen.queryByText(overLimitSentence)).not.toBeInTheDocument();
    expect(screen.queryByText("This amount is above your approval limit.")).not.toBeInTheDocument();
  });
});
