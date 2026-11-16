import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ApplicationScreen } from "./ApplicationScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let refusal: string;
let stored: Record<string, string>;

const questions = [
  { id: "q1", prompt: "Stall location" },
  { id: "q2", prompt: "Number of trading days" },
];

beforeEach(() => {
  openAgency("town");
  permissions = ["application.correct"];
  refusal = "";
  stored = { q1: "Riverside Square", q2: "Three" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "forms_submission_read_mine") return { id: "s1", form_id: "f1", member_id: "m1" };
    if (name === "forms_question_list") return { items: questions };
    if (name === "forms_answer_list") return { items: questions.map((question) => ({ id: `a-${question.id}`, question_id: question.id, member_id: "m1", value_text: stored[question.id] })) };
    if (name === "forms_form_withdraw") return {};
    if (name === "forms_submission_correct") {
      if (refusal) throw new mcp.McpError(refusal);
      (args as { answers: { question_id: string; value_text: string }[] }).answers.forEach((answer) => (stored[answer.question_id] = answer.value_text));
      return {};
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openApplication = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/services/applications/f1"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/services/applications/:id" element={<ApplicationScreen />} />
      </Routes>
    </MemoryRouter>,
  );

describe("correcting a sent application from its screen", () => {
  it("sends only the changed answer for the resident who sent it and shows the correction", async () => {
    openApplication();
    await screen.findByText("Three");

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const days = screen.getByLabelText("Number of trading days");
    await userEvent.clear(days);
    await userEvent.type(days, "Two");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_correct", { form_id: "f1", member_id: "m1", answers: [{ question_id: "q2", value_text: "Two" }] }));
    expect(await screen.findByText("Two")).toBeTruthy();
    expect(screen.getByText("Riverside Square")).toBeTruthy();
  });

  it("starts each input from what the resident sent and keeps Save off until an answer changes", async () => {
    openApplication();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect((screen.getByLabelText("Stall location") as HTMLInputElement).value).toBe("Riverside Square");
    expect((screen.getByLabelText("Number of trading days") as HTMLInputElement).value).toBe("Three");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the hub's words when it refuses and keeps the answers as sent", async () => {
    refusal = "forms_submission_correct: that question is not on this form";
    openApplication();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Stall location"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("that question is not on this form")).toBeTruthy();
    expect(stored.q1).toBe("Riverside Square");
  });

  it("shows no Edit to a caller without application.correct and keeps Withdraw", async () => {
    permissions = [];
    openApplication();

    await screen.findByText("Three");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeTruthy();
  });

  it("keeps Withdraw beside Edit for a holder of the permission", async () => {
    openApplication();

    expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeTruthy();
  });
});
