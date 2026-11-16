import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const confirm: MemberStep = {
  id: "s2",
  title: "Confirm arrival",
  formName: "Arrival",
  roleName: "Liaison",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o7",
  recordCode: "REC-1",
  earlier: [],
  questions: [{ prompt: "Arrived", answerType: "yes_no", helper: "", required: true }],
};

const withEarlier = {
  ...confirm,
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

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("a waiting step shows its prompt and what the earlier roles answered", () => {
  it("shows the prompt", async () => {
    await show(clientOf([withEarlier]));
    expect(screen.getByText("Call the clinic and ask who arrived.")).toBeInTheDocument();
  });

  it("shows each earlier step's title and role name", async () => {
    await show(clientOf([withEarlier]));
    expect(screen.getByText("Report a referral")).toBeInTheDocument();
    expect(screen.getByText(/Volunteer/)).toBeInTheDocument();
  });

  it("shows each earlier prompt with its answer", async () => {
    await show(clientOf([withEarlier]));
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Needs a clinic check")).toBeInTheDocument();
    expect(screen.getByText("Minutes to the clinic")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("shows none of them for a step with neither", async () => {
    await show(clientOf([confirm]));
    expect(screen.queryByText("Call the clinic and ask who arrived.")).not.toBeInTheDocument();
    expect(screen.queryByText("Report a referral")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs a clinic check")).not.toBeInTheDocument();
  });
});
