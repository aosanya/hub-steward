import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { routes as appRoutes } from "../routes";
import { App } from "../App";
import { FormsProvider } from "../../features/forms/context";
import type { FormsClient } from "../../features/forms/api";
import { StepPage } from "../../features/steps/StepPage";
import type { MemberStep, StepsClient } from "../../features/steps/api";
import { RoomThreadPage } from "../../features/chat/rooms/RoomThreadPage";
import type { RoomsClient } from "../../features/chat/rooms/api";
import { forgetWidth, setWide } from "../../features/inbox/fakeWidth";
import { settingReply, settingsOf } from "./settingsFake";
import { items, routes } from "./sections/residents";
import { OwnershipPage } from "./sections/properties/OwnershipPage";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let landed = "";

function Where() {
  landed = useLocation().pathname;
  return null;
}

const clickBack = async () => {
  await waitFor(() => expect(document.querySelector(".back")).not.toBeNull());
  await userEvent.click(document.querySelector(".back") as HTMLElement);
};

const tenures = [{ id: "t1", place_id: "n1", holder: "Szabó Katalin", holder_actor_id: "p1", kind: "owner", since: "2019-03-01T00:00:00Z" }];

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    const setting = settingReply(settingsOf({}), tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }, { module: "digitaltwin" }] };
    if (tool === "agency_get_my_roles") return { permissions: ["member.view"] };
    if (tool === "actor_list_actors") return { items: [{ id: "p1", display_name: "Szabó Katalin", status: "active" }] };
    if (tool === "actor_get_actor") return { id: "p1", display_name: "Szabó Katalin", status: "active" };
    if (tool === "digitaltwin_tenure_list") return { items: tenures };
    if (tool === "digitaltwin_tenure_read") return { item: tenures.find((tenure) => tenure.id === given.tenureID) };
    if (tool === "digitaltwin_node_list") return { items: [{ id: "n1", name: "Kossuth utca 7" }] };
    return { items: [] };
  });

beforeEach(() => {
  openAgency("town");
  landed = "";
});

afterEach(() => {
  cleanup();
  forgetWidth();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Back of a screen that shows its data", () => {
  it("a resident opened from All People goes back to All People", async () => {
    hub();
    const people = items.find((item) => item.title === "All People")?.path?.() ?? "";
    render(
      <MemoryRouter initialEntries={[people]}>
        <Routes>{routes()}</Routes>
        <Where />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Szabó Katalin/ }));
    await screen.findByText("Kossuth utca 7", { selector: ".ttl" });

    await clickBack();

    expect(landed).toBe(people);
  });

  it("a holding opened under Ownership & Tenure goes back to the Properties section", async () => {
    setWide(true);
    hub();
    render(
      <MemoryRouter initialEntries={["/a/town/menu/properties/page"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/properties/page" element={<OwnershipPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    await userEvent.click((await screen.findAllByText(/Kossuth utca 7/, { selector: ".meta" }))[0]);
    await waitFor(() => expect(document.querySelector(".wf .wf-main .wf-content")?.textContent).toContain("Szabó Katalin"));

    await clickBack();

    expect(landed).toMatch(/\/menu\/properties$/);
  });

  it("a form with its questions goes back to the forms list", async () => {
    const client: FormsClient = {
      waiting: async () => [{ form_id: "f1", title: "Access needs", closes_at: "2026-11-01T00:00:00Z", questions: 1, answered: false, unanswered_as: [] }],
      answered: async () => [],
      standing: async () => [],
      questions: async () => [{ id: "q1", prompt: "What do you need", answer_type: "free_text", required: true, options: [] }],
      submit: async () => {},
    };
    render(
      <FormsProvider client={client}>
        <MemoryRouter initialEntries={["/a/town/forms/f1"]}>
          <App />
          <Where />
        </MemoryRouter>
      </FormsProvider>,
    );
    await screen.findByText("What do you need");

    await clickBack();

    expect(landed).toBe("/a/town/forms");
  });

  it("a step with its questions goes back to Do Something", async () => {
    const step: MemberStep = {
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
      earlier: [],
      questions: [{ prompt: "Reason", answerType: "free_text", helper: "", required: true }],
    };
    const steps: StepsClient = { available: async () => [step], submit: async () => ({ done: true, next: null, orderId: "o1" }) };
    render(
      <MemoryRouter initialEntries={[appRoutes.step.path({ stepId: "s1" })]}>
        <Routes>
          <Route path={appRoutes.step.pattern} element={<StepPage steps={steps} />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    await screen.findByLabelText("Reason");

    await clickBack();

    expect(landed).toBe("/a/town/do-something");
  });

  it("a chat thread with its messages goes back to the chat list", async () => {
    const client: RoomsClient = {
      subject: async () => "u1",
      roomName: async () => "Street group",
      listThreads: async () => [{ id: "t1", label: "General", audience: "group", requestedBy: "", askerName: "", questionRoom: false, takesQuestions: false, leader: false, declined: false } as never],
      listMessages: async () => [{ id: "m1", author: "Szabó Katalin", agent: false, mine: false, body: "Good morning", at: "2026-10-28T09:12:00Z", kind: "", targetId: "" }],
      post: async () => undefined,
      startThread: async () => "t9",
      getOrder: async () => ({}) as never,
      answerRevision: async () => undefined,
      getAsk: async () => null,
      setQuestionRoom: async () => undefined,
    };
    render(
      <MemoryRouter initialEntries={[appRoutes.roomThread.path({ roomId: "r1", threadId: "t1" })]}>
        <Routes>
          <Route path={appRoutes.roomThread.pattern} element={<RoomThreadPage client={client} />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    await screen.findByText("Good morning");

    await clickBack();

    expect(landed).toMatch(/\/chat/);
  });
});
