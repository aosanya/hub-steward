import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { dateTimeWords } from "../../shared/ui/days";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const at = "2026-11-23T09:30:00Z";

const reopened = {
  id: "s1",
  title: "Write the proposal",
  formName: "Proposal",
  roleName: "Service Line Lead",
  workflowName: "Tender",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o7",
  recordCode: "REC-1",
  earlier: [],
  questions: [
    { prompt: "Summary", answerType: "free_text", helper: "", required: true },
    { prompt: "Value", answerType: "number", helper: "", required: true },
    { prompt: "Open", answerType: "yes_no", helper: "" },
  ],
  sentBack: { reason: "The budget is missing", roleName: "Practice Director", at, answers: { Summary: "Clean water for six villages", Value: "120", Open: "yes" } },
} as unknown as MemberStep;

const clientOf = (found: MemberStep[]): StepsClient => ({
  available: async () => found,
  submit: vi.fn(async () => ({ done: true, next: null, orderId: "o7" })),
});

const show = async (client: StepsClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s1" }, { order: "o7" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  openAgency("farmers");
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("a step the platform sent back", () => {
  it("says who sent it back, when, and why, in an info notice", async () => {
    await show(clientOf([reopened]));
    const notice = screen.getByRole("status");
    expect(within(notice).getByText(`Sent back by Practice Director on ${dateTimeWords(at)}`)).toBeInTheDocument();
    expect(within(notice).getByText("The budget is missing")).toBeInTheDocument();
  });

  it("puts the notice above the first question", async () => {
    await show(clientOf([reopened]));
    const notice = screen.getByRole("status");
    const first = screen.getByLabelText("Summary");
    expect(notice.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no notice on a step nobody sent back", async () => {
    await show(clientOf([{ ...reopened, sentBack: undefined } as unknown as MemberStep]));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sent back by/)).not.toBeInTheDocument();
  });

  it("starts the fields with the answers she gave before", async () => {
    await show(clientOf([reopened]));
    expect(screen.getByLabelText("Summary")).toHaveValue("Clean water for six villages");
    expect(screen.getByLabelText("Value")).toHaveValue(120);
    expect(screen.getByRole("radio", { name: /yes/i })).toBeChecked();
  });

  it("sends the prefilled answers, with what she changed, to the same run", async () => {
    const client = clientOf([reopened]);
    await show(client);
    const summary = screen.getByLabelText("Summary");
    await userEvent.clear(summary);
    await userEvent.type(summary, "Clean water, with a budget");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1", orderId: "o7" }),
      { Summary: "Clean water, with a budget", Value: "120", Open: "yes" },
      expect.any(String),
    );
  });

  it("keeps a draft she already saved over the answers sent back", async () => {
    await show(clientOf([reopened]));
    await userEvent.type(screen.getByLabelText("Summary"), " and a well");
    cleanup();
    await show(clientOf([reopened]));
    expect(screen.getByLabelText("Summary")).toHaveValue("Clean water for six villages and a well");
  });
});
