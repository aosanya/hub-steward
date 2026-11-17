import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { dayWords } from "../../../../shared/ui/days";
import { ApplicationScreen } from "./ApplicationScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const sent = { id: "s9", form_id: "f9", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z" };

const decidedOn = "2026-03-10T12:00:00Z";

const decidedLine = `${dayWords(decidedOn)} by Ilona Varga`;

const questions = [{ id: "q1", prompt: "Fence height" }];

const answers = [{ id: "a1", question_id: "q1", member_id: "m1", value_text: "Two metres" }];

const answerWith = (send: Record<string, unknown>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_my_roles") return { permissions: [] };
    if (name === "forms_submission_read_mine") return { ...sent, ...send };
    if (name === "forms_question_list") return { items: questions };
    if (name === "forms_answer_list") return { items: answers };
    throw new Error(`${name} is not a tool this screen may use`);
  });

const openApplication = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/services/applications/f9"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/services/applications/:id" element={<ApplicationScreen />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("an application's page shows the decision on it", () => {
  it("reads Refused with who decided, the day and the reason, and no longer reads Sent", async () => {
    answerWith({ decision: "refused", decided_by: "Ilona Varga", decided_at: decidedOn, decision_note: "The fence is taller than the street allows" });
    openApplication();

    expect(await screen.findByText("Refused")).toBeInTheDocument();
    expect(screen.getByText("Decided")).toBeInTheDocument();
    expect(screen.getByText(decidedLine)).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("The fence is taller than the street allows")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("reads Approved with who decided and the day, and no reason row when there is no note", async () => {
    answerWith({ decision: "approved", decided_by: "Ilona Varga", decided_at: decidedOn, decision_note: "" });
    openApplication();

    expect(await screen.findByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Decided")).toBeInTheDocument();
    expect(screen.getByText(decidedLine)).toBeInTheDocument();
    expect(screen.queryByText("Reason")).toBeNull();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("keeps reading Sent with no decision line when nothing has been decided", async () => {
    answerWith({ decision: "", decided_by: "", decided_at: "", decision_note: "" });
    openApplication();

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    await screen.findByText("Two metres");
    expect(screen.queryByText("Decided")).toBeNull();
    expect(screen.queryByText("Reason")).toBeNull();
    expect(screen.queryByText("Approved")).toBeNull();
    expect(screen.queryByText("Refused")).toBeNull();
  });

  it("keeps reading Withdrawn for a withdrawn application", async () => {
    answerWith({ withdrawn_at: "2026-03-06T12:00:00Z", decision: "", decided_by: "", decided_at: "", decision_note: "" });
    openApplication();

    expect(await screen.findByText("Withdrawn")).toBeInTheDocument();
    await screen.findByText("Two metres");
    expect(screen.queryByText("Sent")).toBeNull();
    expect(screen.queryByText("Decided")).toBeNull();
  });
});
