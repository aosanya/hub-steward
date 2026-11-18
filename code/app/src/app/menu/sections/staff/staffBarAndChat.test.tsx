import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, forgetChatAbout } from "../../../chatAbout";
import { CrewsScreen, DepartmentsScreen, RolesPermissionsScreen, StaffScreen } from "./index";
import { staffPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_publications") return { items: [{ channel: "production", version: 2, draft_id: "d1" }] };
  if (name === "agency_list_roles") return { items: [{ id: "r1", code: "R-1", name: "Clerk", permissions: [] }] };
  if (name === "actor_list_role_kinds") return { items: [{ id: "k1", definition_role_id: "R-1", name: "Clerk" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view", "member.edit", "group.manage"] };
  if (name === "actor_list_actors") return { items: [{ id: "a1", display_name: "Anna Sample", status: "active" }] };
  if (name === "actor_get_actor") return { id: "a1", display_name: "Anna Sample", status: "active", attributes: {} };
  if (name === "actor_list_groups")
    return {
      items: [
        { id: "g1", name: "Sample Works Department", node_type: "Department" },
        { id: "g2", name: "Sample Road Crew", node_type: "Crew" },
      ],
    };
  if (name === "actor_get_group") return { item: { id: given.group_id, name: given.group_id === "g1" ? "Sample Works Department" : "Sample Road Crew" } };
  return { items: [] };
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

type Screen = { name: string; pattern: string; entry: () => string; element: JSX.Element; heading: string; about: string; subject: Record<string, unknown> };

const screens: Screen[] = [
  { name: "Staff", pattern: staffPaths.people.pattern, entry: () => `${staffPaths.people.path()}?person=a1`, element: <StaffScreen />, heading: "Anna Sample", about: "Anna Sample", subject: { kind: "staff", id: "a1", name: "Anna Sample" } },
  { name: "Departments", pattern: staffPaths.departments.pattern, entry: () => `${staffPaths.departments.path()}?group=g1`, element: <DepartmentsScreen />, heading: "Sample Works Department", about: "Sample Works Department", subject: { kind: "group", id: "g1", name: "Sample Works Department" } },
  { name: "Crews", pattern: staffPaths.crews.pattern, entry: () => `${staffPaths.crews.path()}?group=g2`, element: <CrewsScreen />, heading: "Sample Road Crew", about: "Sample Road Crew", subject: { kind: "group", id: "g2", name: "Sample Road Crew" } },
  { name: "Roles & Permissions", pattern: staffPaths.roles.pattern, entry: () => `${staffPaths.roles.path()}?role=r1`, element: <RolesPermissionsScreen />, heading: "Clerk", about: "Clerk", subject: { kind: "role", id: "k1", name: "Clerk", extra: { draft: "d1" } } },
];

const widths = [
  { label: "wide", wide: true },
  { label: "phone", wide: false },
];

describe.each(screens)("$name screen", (screenCase) => {
  describe.each(widths)("on a $label screen", ({ wide }) => {
    const open = async () => {
      setWide(wide);
      render(
        <MemoryRouter initialEntries={[screenCase.entry()]}>
          <Routes>
            <Route path={screenCase.pattern} element={screenCase.element} />
            <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByRole("heading", { level: 1, name: screenCase.heading });
    };

    it("draws the bottom bar with Home and Chat", async () => {
      await open();
      const bar = screen.getByRole("navigation", { name: "Main" });
      expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
      expect(within(bar).getByRole("link", { name: "Chat" })).toBeInTheDocument();
    });

    it("opens the assistant about the page on screen from the Chat tab", async () => {
      await open();
      await userEvent.click(screen.getByRole("link", { name: "Chat" }));
      await screen.findByText(`About ${screenCase.about}`);
      expect(carriedChatAbout()).toEqual(screenCase.subject);
    });
  });
});
