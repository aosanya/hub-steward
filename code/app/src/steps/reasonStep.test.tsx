import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const reasonPrompt = "Your reason, in your own name: why did the council decide differently from what residents said?";
const departurePrompt = "Your reason, in your own name: why does the decision depart from the residents' ranking?";
const completedPrompt = "Did we complete the step?";

const mayorReason: MemberStep = {
  id: "m1",
  title: "State the reason",
  formName: "The mayor states the reason by name",
  roleName: "Mayor",
  workflowName: "Council decision",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-1",
  questions: [{ prompt: reasonPrompt, answerType: "free_text", helper: "", required: true }],
};

const completedWithReason: MemberStep = {
  ...mayorReason,
  id: "m2",
  formName: "Complete the step and state the reason",
  questions: [
    { prompt: completedPrompt, answerType: "yes_no", helper: "", required: true },
    { prompt: departurePrompt, answerType: "free_text", helper: "", required: true },
  ],
};

const clientOf = (found: MemberStep[]): StepsClient => ({
  available: async () => found,
  submit: vi.fn(async () => ({ done: true, next: null, orderId: "o1" })),
});

const show = async (client: StepsClient, at: string) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: at })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("the mayor states the reason on the step page", () => {
  it("shows one text input labelled with the reason prompt", async () => {
    await show(clientOf([mayorReason]), "m1");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByLabelText(reasonPrompt)).toHaveAttribute("type", "text");
  });

  it("does not send while the reason is empty and says which question needs an answer", async () => {
    const client = clientOf([mayorReason]);
    await show(client, "m1");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(1);
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason keyed by the full prompt once it is typed", async () => {
    const client = clientOf([mayorReason]);
    await show(client, "m1");
    await userEvent.type(screen.getByLabelText(reasonPrompt), "  The road budget was already spent  ");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledWith(mayorReason, { [reasonPrompt]: "The road budget was already spent" }, expect.any(String));
  });
});

describe("a step that keeps its yes/no question first and adds the mayor's reason", () => {
  it("shows both questions", async () => {
    await show(clientOf([completedWithReason]), "m2");
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();
    expect(screen.getByLabelText(departurePrompt)).toHaveAttribute("type", "text");
  });

  it("refuses to send until both are answered, then sends both keyed by prompt", async () => {
    const client = clientOf([completedWithReason]);
    await show(client, "m2");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(2);
    expect(client.submit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(1);
    expect(client.submit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(departurePrompt), "Residents ranked it lower than the clinic");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledWith(
      completedWithReason,
      { [completedPrompt]: "yes", [departurePrompt]: "Residents ranked it lower than the clinic" },
      expect.any(String),
    );
  });
});
