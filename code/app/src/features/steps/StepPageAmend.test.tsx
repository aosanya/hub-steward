import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const waiting = {
  id: "s2",
  title: "Confirm arrival",
  formName: "Confirm arrival",
  roleName: "Liaison",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o7",
  recordCode: "REC-1",
  prompt: "Call the clinic and ask who arrived.",
  earlier: [
    {
      stepTitle: "Report a referral",
      roleName: "Volunteer",
      answers: [
        { prompt: "Reason", answer: "Needs a clinic check" },
        { prompt: "Minutes to the clinic", answer: "25" },
      ],
    },
  ],
  questions: [{ prompt: "Arrived", answerType: "yes_no", helper: "", required: true }],
} as unknown as MemberStep;

const clientOf = (found: MemberStep[]): StepsClient => ({ available: async () => found, submit: vi.fn(async () => ({ done: true, next: null, orderId: "o7" })) });

const show = async (client: StepsClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s2" }, { order: "o7" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const answersSent = (client: StepsClient) => (client.submit as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, string>;

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("amending the earlier draft before approving", () => {
  it("sends a changed answer and a struck answer along with the step's own answer", async () => {
    const client = clientOf([waiting]);
    await show(client);
    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Needs a dentist" } });
    await userEvent.click(screen.getAllByRole("button", { name: "Strike out" })[1]);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledTimes(1);
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s2", state: "waiting", orderId: "o7" }),
      {
        Arrived: "yes",
        "Changed: Report a referral: Reason": 'Changed from "Needs a clinic check" to "Needs a dentist"',
        "Changed: Report a referral: Minutes to the clinic": 'Struck out "25"',
      },
      expect.any(String),
    );
  });

  it("sends nothing about an answer that was opened for change and left as it was", async () => {
    const client = clientOf([waiting]);
    await show(client);
    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(answersSent(client)).toEqual({ Arrived: "yes" });
  });

  it("sends nothing about an answer that was struck and then kept", async () => {
    const client = clientOf([waiting]);
    await show(client);
    await userEvent.click(screen.getAllByRole("button", { name: "Strike out" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(answersSent(client)).toEqual({ Arrived: "yes" });
  });

  it("sends no Changed entry when nothing was edited", async () => {
    const client = clientOf([waiting]);
    await show(client);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const sent = answersSent(client);
    expect(sent).toEqual({ Arrived: "yes" });
    expect(Object.keys(sent).some((k) => k.startsWith("Changed:"))).toBe(false);
  });
});

describe("a step that reviews earlier work", () => {
  const leadLine = "Read the work so far, then give your decision.";
  const before = (first: HTMLElement, second: HTMLElement) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("opens the card with one lead line saying what to do", async () => {
    await show(clientOf([waiting]));
    const lead = screen.getByText(leadLine);
    const card = lead.closest(".card") as HTMLElement;
    expect(card.firstElementChild).toBe(lead);
  });

  it("puts a Work so far heading over the earlier steps", async () => {
    await show(clientOf([waiting]));
    const heading = screen.getByRole("heading", { level: 2, name: "Work so far" });
    expect(before(heading, screen.getByText("Report a referral"))).toBe(true);
  });

  it("puts a Your decision heading after the earlier steps and over the step's own questions", async () => {
    await show(clientOf([waiting]));
    const heading = screen.getByRole("heading", { level: 2, name: "Your decision" });
    expect(before(screen.getByText("25"), heading)).toBe(true);
    expect(before(heading, screen.getByText("Arrived"))).toBe(true);
  });

  it("shows no lead line and no headings on a step with no earlier work", async () => {
    await show(clientOf([{ ...waiting, earlier: [] } as unknown as MemberStep]));
    expect(screen.queryByText(leadLine)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Work so far" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your decision" })).not.toBeInTheDocument();
  });
});
