import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { StartRows } from "../../app/home/StartRows";
import { routes } from "../../app/routes";
import { mcpStepsClient, type MemberStep } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const approval: MemberStep = {
  id: "s1",
  title: "Approve the agenda",
  formName: "Agenda approval",
  roleName: "Mayor / council chair",
  workflowName: "Council meeting",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "run-1",
  recordCode: "REC-1",
  earlier: [],
  questions: [{ prompt: "Reason", answerType: "free_text", helper: "", required: true }],
};

const serverReply = {
  step_id: "s1",
  order_id: "run-1",
  record_code: "REC-1",
  row_id: "row1",
  done: true,
  next_step: {
    id: "s2",
    title: "Publish the agenda",
    kind: "fill_form",
    workflow_id: "w1",
    workflow_name: "Council meeting",
    role_id: "r2",
    role_name: "Communications officer",
    form_name: "Publication",
    record_code: "REC-2",
    state: "waiting",
    order_id: "run-1",
  },
};

const sendAgendaApproval = async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(serverReply), { status: 201 }));
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[`${routes.step.path({ stepId: "s1" })}?order=run-1`]}>
        <Routes>
          <Route
            path={routes.step.pattern}
            element={<StepPage steps={{ available: async () => [approval], submit: mcpStepsClient.submit }} />}
          />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await userEvent.type(screen.getByLabelText("Reason"), "Agenda is in order");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const showStart = async () => {
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
  vi.restoreAllMocks();
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("the real send reply, where done means this step is done and next_step names the following role", () => {
  it("shows Next: Communications officer on the Sent row", async () => {
    await sendAgendaApproval();
    cleanup();
    await showStart();
    const row = (await screen.findByText("Agenda approval")).closest(".row")!;
    expect(row).toHaveTextContent("Sent");
    expect(row).toHaveTextContent("Next: Communications officer");
  });
});
