import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent, wasSent } from "./sent";
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

const show = async (submit: StepsClient["submit"]) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s1" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={{ available: async () => [referral], submit }} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await userEvent.type(screen.getByLabelText("Reason"), "Fever");
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("sending a step is safe to repeat", () => {
  it("says Sending on the button and keeps it disabled while the send is on its way", async () => {
    await show(() => new Promise<never>(() => undefined));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Sending" })).toBeDisabled();
  });

  it("sends the same key again when Send is pressed after a failure", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new StepRefused("timeout")).mockResolvedValueOnce({ done: true, next: null, orderId: "o1" });
    await show(submit);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("This is taking too long. Try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const [first, second] = submit.mock.calls.map((call) => call[2]);
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
  });

  it("marks the step Sent when the server says it was already sent", async () => {
    await show(vi.fn().mockResolvedValue({ done: false, next: null, orderId: "" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(wasSent({ id: "s1", orderId: "" })).toBe(false);
    expect(wasSent({ id: "s1", orderId: "sent-1" })).toBe(true);
  });

  it("makes a new key for each opening of the form", async () => {
    const submit = vi.fn().mockRejectedValue(new StepRefused("failed"));
    await show(submit);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    cleanup();
    await show(submit);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit.mock.calls[1][2]).not.toBe(submit.mock.calls[0][2]);
  });
});
