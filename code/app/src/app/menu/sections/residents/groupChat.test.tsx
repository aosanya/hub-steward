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
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const groupName = "Sample Garden Group";

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "comm" }] };
  if (name === "agency_get_my_roles") return { permissions: ["resident.read", "member.view", "group.manage"] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: groupName, node_type: "household" }] };
  if (name === "actor_get_group") return { id: given.group_id, name: groupName, join_mode: "open" };
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

const openScreen = async (title: string) => {
  setWide(true);
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[`${path}?group=g1`]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: groupName });
};

describe.each(["Households", "Groups & Associations"])("Chat in the bar on %s", (title) => {
  it("opens the assistant about the open group", async () => {
    await openScreen(title);
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About ${groupName}`);
    expect(screen.getByRole("textbox", { name: `Ask about ${groupName}` })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "group", id: "g1", name: groupName });
  });
});
