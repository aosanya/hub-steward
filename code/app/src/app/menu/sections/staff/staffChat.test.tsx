import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, forgetChatAbout } from "../../../chatAbout";
import { StaffScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const answer = async (name: string) => {
  if (name === "agency_get_my_roles") return { permissions: ["member.view", "member.edit"] };
  if (name === "actor_list_actors") return { items: [{ id: "a1", display_name: "Anna Sample", status: "active" }] };
  if (name === "actor_get_actor") return { id: "a1", display_name: "Anna Sample", status: "active", attributes: {} };
  return { items: [] };
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openStaff = (search: string) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/staff/people${search}`]}>
      <Routes>
        <Route path="/a/:agencyId/menu/staff/people" element={<StaffScreen />} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Chat in the bar on a staff member's page", () => {
  it("opens the assistant about the chosen member, with Seats, Details and Groups", async () => {
    openStaff("?person=a1");
    await screen.findByRole("heading", { level: 1, name: "Anna Sample" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Anna Sample");
    expect(screen.getByRole("textbox", { name: "Ask about Anna Sample" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "staff", id: "a1", name: "Anna Sample" });
  });

  it("carries nothing while no member is chosen, so the Chat tab opens the plain assistant", async () => {
    openStaff("");
    await screen.findByRole("button", { name: /Anna Sample/ });
    expect(carriedChatAbout()).toBeNull();
  });
});
