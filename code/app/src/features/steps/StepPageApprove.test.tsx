import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

vi.mock("../account/profile", () => ({
  readProfile: vi.fn(async () => ({ name: "Anna Kovacs", code: "MUN-1", phone: "" })),
}));

const permit: MemberStep = {
  id: "s2",
  title: "Approve the permit",
  formName: "Permit",
  roleName: "Director",
  workflowName: "Permit",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o7",
  recordCode: "REC-1",
  earlier: [],
  questions: [{ prompt: "Approved", answerType: "yes_no", helper: "", required: true }],
  approval: false,
} as MemberStep;

const approving = { ...permit, approval: true } as MemberStep;

const clientOf = (found: MemberStep[], submit?: StepsClient["submit"]): StepsClient => ({
  available: async () => found,
  submit: submit ?? vi.fn(async () => ({ done: true, next: null, orderId: "o7" })),
});

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
  vi.clearAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("an approval step", () => {
  it("shows the own-name panel with her display name", async () => {
    await show(clientOf([approving]));
    expect(screen.getByText("You approve this in your own name, as Anna Kovacs.")).toBeInTheDocument();
    expect(screen.getByText("The time and your name are recorded with your answer.")).toBeInTheDocument();
  });

  it("names the send button Approve", async () => {
    await show(clientOf([approving]));
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("reads Sending on the button while the answer is on its way", async () => {
    let finish: () => void = () => {};
    const submit = vi.fn(() => new Promise<any>((resolve) => (finish = () => resolve({ done: true, next: null, orderId: "o7" }))));
    await show(clientOf([approving], submit));
    await act(async () => screen.getByRole("radio", { name: /yes/i }).click());
    await act(async () => screen.getByRole("button", { name: "Approve" }).click());
    expect(screen.getByRole("button", { name: "Sending" })).toBeDisabled();
    await act(async () => finish());
  });
});

describe("a step that is not an approval", () => {
  it("keeps the Send button and shows no panel", async () => {
    await show(clientOf([permit]));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByText(/You approve this in your own name/)).not.toBeInTheDocument();
  });
});
