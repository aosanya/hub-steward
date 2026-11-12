import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { StartRows } from "../home/StartRows";
import { routes } from "../routes";
import { StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent, sentSteps } from "./sent";
import { StepPage } from "./StepPage";

const referral: MemberStep = {
  id: "s1",
  title: "Refer the case",
  formName: "Referral",
  roleName: "Volunteer",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-1",
  questions: [{ prompt: "Reason", answerType: "free_text", helper: "", required: true }],
};

const reviewer: MemberStep = { ...referral, id: "s2", formName: "Review", roleName: "Coordinator", state: "waiting", orderId: "o1" };

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const sendWith = async (submit: StepsClient["submit"]) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s1" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={{ available: async () => [referral], submit }} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await userEvent.type(screen.getByLabelText("Reason"), "Fever");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const showRows = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <StartRows
          kind="farmers"
          start={{ openSteps: async () => [], waiting: async () => [] }}
          steps={{ available: async () => [] }}
          forms={{ waiting: async () => [], answered: async () => [] }}
        />
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("after Send the member is told whose turn is next", () => {
  it("names the role whose turn is next on the Sent row", async () => {
    await sendWith(vi.fn(async () => ({ done: false, next: reviewer, orderId: "o1" })));
    cleanup();
    await showRows();
    const row = (await screen.findByText("Referral")).closest(".row")!;
    expect(row).toHaveTextContent("Sent");
    expect(row).toHaveTextContent("Next: Coordinator");
  });

  it("says Done on the Sent row when the task is finished", async () => {
    await sendWith(vi.fn(async () => ({ done: true, next: null, orderId: "o1" })));
    cleanup();
    await showRows();
    const row = (await screen.findByText("Referral")).closest(".row")!;
    expect(row).toHaveTextContent("Done");
  });

  it("says nothing about the next turn when the server only said it was already sent", async () => {
    await sendWith(vi.fn(async () => ({ done: false, next: null, orderId: "" })));
    cleanup();
    await showRows();
    const row = (await screen.findByText("Referral")).closest(".row")!;
    expect(row).toHaveTextContent("Sent");
    expect(row).not.toHaveTextContent("Next");
    expect(row).not.toHaveTextContent("Done");
    expect(sentSteps()).toHaveLength(1);
  });
});

describe("a refused send gives the member a next move besides Back", () => {
  it("offers Start when the step is not for her role", async () => {
    await sendWith(vi.fn().mockRejectedValue(new StepRefused("role")));
    await userEvent.click(await screen.findByRole("link", { name: "Go to Start" }));
    expect(landed).toBe("/a/farmers/do-something");
  });

  it("offers Ongoing when the step is not ready or was already sent", async () => {
    await sendWith(vi.fn().mockRejectedValue(new StepRefused("not-ready")));
    await userEvent.click(await screen.findByRole("link", { name: "Go to Ongoing" }));
    expect(landed).toBe("/a/farmers/ongoing");
  });

  it("offers no extra move when she can simply try again", async () => {
    await sendWith(vi.fn().mockRejectedValue(new StepRefused("failed")));
    await screen.findByText("Your answers could not be sent. Try again.");
    expect(screen.queryByRole("link", { name: /^Go to/ })).not.toBeInTheDocument();
  });
});
