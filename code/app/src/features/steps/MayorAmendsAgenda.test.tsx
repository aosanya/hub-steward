import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../../routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const approveTheAgenda = {
  id: "s5",
  title: "Approve the agenda",
  formName: "Approve the agenda",
  roleName: "Mayor",
  workflowName: "Council meeting",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o42",
  recordCode: "WI-42-3",
  prompt: "Correct or strike out whatever does not hold up.",
  earlier: [
    {
      stepTitle: "Draft the agenda",
      roleName: "Clerk",
      answers: [
        { prompt: "Item 1", answer: "Budget amendment" },
        { prompt: "Item 2", answer: "Street naming" },
        { prompt: "Item 3", answer: "Closed session on staffing" },
      ],
    },
  ],
  questions: [{ prompt: "Approve the agenda?", answerType: "yes_no", helper: "", required: true }],
} as unknown as MemberStep;

const clientOf = (found: MemberStep[]): StepsClient => ({ available: async () => found, submit: vi.fn(async () => ({ done: true, next: null, orderId: "o42" })) });

const show = async (client: StepsClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s5" }, { order: "o42" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const answersSent = (client: StepsClient) => (client.submit as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, string>;

beforeEach(() => openAgency("municipality"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("a Mayor amends the draft agenda on the phone", () => {
  it("shows the Clerk's draft agenda to the Mayor", async () => {
    await show(clientOf([approveTheAgenda]));
    expect(screen.getByText("Draft the agenda")).toBeTruthy();
    expect(screen.getByText("Clerk")).toBeTruthy();
    expect(screen.getByText("Budget amendment")).toBeTruthy();
    expect(screen.getByText("Street naming")).toBeTruthy();
    expect(screen.getByText("Closed session on staffing")).toBeTruthy();
  });

  it("sends the changed and struck items with the Mayor's answer and nothing for the untouched item", async () => {
    const client = clientOf([approveTheAgenda]);
    await show(client);
    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);
    fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: "Budget amendment, second reading" } });
    await userEvent.click(screen.getAllByRole("button", { name: "Strike out" })[2]);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledTimes(1);
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s5", state: "waiting", orderId: "o42" }),
      {
        "Approve the agenda?": "yes",
        "Changed: Draft the agenda: Item 1": 'Changed from "Budget amendment" to "Budget amendment, second reading"',
        "Changed: Draft the agenda: Item 3": 'Struck out "Closed session on staffing"',
      },
      expect.any(String),
    );
    expect(Object.keys(answersSent(client))).not.toContain("Changed: Draft the agenda: Item 2");
  });

  it("sends no Changed entry when the Mayor changes nothing", async () => {
    const client = clientOf([approveTheAgenda]);
    await show(client);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const sent = answersSent(client);
    expect(sent).toEqual({ "Approve the agenda?": "yes" });
    expect(Object.keys(sent).some((k) => k.startsWith("Changed:"))).toBe(false);
  });
});
