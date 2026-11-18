import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

const askerName = "Sample Asker A";
const groupName = "Sample Garden Group";

let permissions: string[] = [];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: groupName }] };
  if (name === "actor_list_join_requests_for_group") return { items: given.group_id === "g1" ? [{ id: "r1", actor_id: "p1", actor_name: "", state: "pending", requested_at: "2026-11-16T12:00:00Z" }] : [] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: askerName }] };
  if (name === "actor_get_actor") return { id: given.actor_id, display_name: askerName, status: "active" };
  return { items: [] };
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  permissions = ["resident.read", "member.view"];
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openRegistrations = async () => {
  setWide(true);
  const path = items.find((item) => item.title === "Registrations")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("region", { name: "Request" });
};

describe("Chat in the bar on Registrations", () => {
  it("opens the assistant about the registration with the About line and a composer named for the person", async () => {
    await openRegistrations();
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About the registration of ${askerName} for ${groupName}`);
    expect(screen.getByRole("textbox", { name: `Ask about ${askerName}` })).toBeInTheDocument();
    expect(carriedChatAbout()).toMatchObject({ kind: "registration", id: "p1", name: askerName, extra: { group: groupName } });
  });

  it("clearing the line brings the plain assistant back", async () => {
    await openRegistrations();
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About the registration of ${askerName} for ${groupName}`);
    await userEvent.click(screen.getByRole("button", { name: `Clear About the registration of ${askerName} for ${groupName}` }));
    await waitFor(() => expect(carriedChatAbout()).toBeNull());
  });

  it("carries nothing to the assistant without the right to read residents", async () => {
    permissions = ["member.view"];
    await openRegistrations();
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    expect(carriedChatAbout()).toBeNull();
  });
});
