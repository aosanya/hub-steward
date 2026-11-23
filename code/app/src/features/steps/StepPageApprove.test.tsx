import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { type MemberStep, type StepsClient } from "./api";
import { forgetSent, sentAfter } from "./sent";
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

const reviewing = {
  ...permit,
  title: "Review the proposal and approve it for submission",
  formName: "Approval for submission",
  prompt: "Record approve, or send back.",
  earlier: [{ stepTitle: "Write the proposal", roleName: "Service Line Lead", answers: [{ prompt: "Price", answer: "120 000" }] }],
  questions: [
    { prompt: "Tender title", answerType: "free_text", helper: "", required: true },
    { prompt: "Approved", answerType: "yes_no", helper: "", required: true },
    { prompt: "Reason", answerType: "free_text", helper: "", required: true },
  ],
  sendBack: { decision: "Approved", reason: "Reason" },
} as unknown as MemberStep;

const sendingClient = (): StepsClient => ({
  available: async () => [reviewing],
  submit: vi.fn(async () => ({ done: true, next: null, orderId: "o7" })),
  sendBack: vi.fn(async () => ({ orderId: "o7", roleName: "Service Line Lead" })),
});

const decisionButtons = () => within(document.querySelector(".bottombar") as HTMLElement).getAllByRole("button").map((b) => b.textContent);

const write = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("a step that can be sent back", () => {
  it("offers Approve and Send back as the two choices of the decision question", async () => {
    await show(sendingClient());
    expect(screen.getByRole("radio", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Send back" })).toBeInTheDocument();
  });

  it("has one decision button, disabled and not called Send, until a choice is made", async () => {
    await show(sendingClient());
    expect(decisionButtons()).toEqual(["Back", "Approve or send back"]);
    expect(screen.getByRole("button", { name: "Approve or send back" })).toBeDisabled();
  });

  it("names the one decision button Approve once Approve is picked", async () => {
    await show(sendingClient());
    await userEvent.click(screen.getByRole("radio", { name: "Approve" }));
    expect(decisionButtons()).toEqual(["Back", "Approve"]);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("names the one decision button Send back once Send back is picked", async () => {
    await show(sendingClient());
    await userEvent.click(screen.getByRole("radio", { name: "Send back" }));
    expect(decisionButtons()).toEqual(["Back", "Send back"]);
  });

  it("sends the answers as an approval when Approve is pressed", async () => {
    const client = sendingClient();
    await show(client);
    write("Tender title", "Water scheme");
    write("Reason", "Price and team agree");
    await userEvent.click(screen.getByRole("radio", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s2", orderId: "o7" }),
      { "Tender title": "Water scheme", Approved: "yes", Reason: "Price and team agree" },
      expect.any(String),
    );
    expect(client.sendBack).not.toHaveBeenCalled();
  });

  it("sends the reason back to the previous step when Send back is pressed, without asking for the other answers", async () => {
    const client = sendingClient();
    await show(client);
    write("Reason", "The price sheet is not signed");
    await userEvent.click(screen.getByRole("radio", { name: "Send back" }));
    await userEvent.click(screen.getByRole("button", { name: "Send back" }));
    expect(client.sendBack).toHaveBeenCalledWith(expect.objectContaining({ id: "s2", orderId: "o7" }), "The price sheet is not signed", expect.any(String));
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("asks for a reason before it sends back", async () => {
    const client = sendingClient();
    await show(client);
    await userEvent.click(screen.getByRole("radio", { name: "Send back" }));
    await userEvent.click(screen.getByRole("button", { name: "Send back" }));
    expect(screen.getByText("This question needs an answer")).toBeInTheDocument();
    expect(client.sendBack).not.toHaveBeenCalled();
  });

  it("keeps the sent list reading who it went back to", async () => {
    await show(sendingClient());
    write("Reason", "The price sheet is not signed");
    await userEvent.click(screen.getByRole("radio", { name: "Send back" }));
    await userEvent.click(screen.getByRole("button", { name: "Send back" }));
    expect(sentAfter({ id: "s2", orderId: "o7" })).toBe("Sent back to Service Line Lead");
  });

  it("keeps Send on a step the server does not offer to send back", async () => {
    await show(clientOf([{ ...reviewing, sendBack: undefined } as unknown as MemberStep]));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Send back" })).not.toBeInTheDocument();
  });
});
