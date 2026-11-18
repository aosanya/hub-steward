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
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const groupName = "Sample Reading Circle";

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "comm" }] };
  if (name === "agency_get_my_roles") return { permissions: ["resident.read", "member.view", "chat.post"] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: groupName }] };
  if (name === "comm_chat_thread_list") return { items: given.structure_id === "g1" ? [{ id: "t1", label: "General", audience: "group", last_message_at: "2026-03-12T12:00:00Z" }] : [] };
  if (name === "comm_chat_message_list") return { items: [{ id: "m1", author_name: "Sample Member", body: "Can we start at nine?", created_at: "2026-03-12T08:12:00Z" }] };
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

const communicationsPath = () => items.find((item) => item.title === "Communications")?.path?.() ?? "";

const openConversation = async (entry: string) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: groupName });
};

describe("Chat in the bar on Communications", () => {
  it("opens the assistant about the open conversation's group and thread", async () => {
    await openConversation(`${communicationsPath()}?thread=t1`);
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About ${groupName}`);
    expect(screen.getByRole("textbox", { name: `Ask about ${groupName}` })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "conversation", id: "g1", name: groupName, extra: { thread: "t1" } });
  });

  it("comes back to the same conversation from the assistant", async () => {
    await openConversation(`${communicationsPath()}?thread=t1`);
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About ${groupName}`);
    expect(carriedChatFrom()).toContain(`${communicationsPath()}?thread=t1`);
  });

  it("opens a conversation chosen from the list", async () => {
    setWide(true);
    render(
      <MemoryRouter initialEntries={[communicationsPath()]}>
        <Routes>
          {routes()}
          <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(groupName) }));
    await screen.findByRole("heading", { level: 1, name: groupName });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About ${groupName}`);
    expect(carriedChatAbout()?.extra).toEqual({ thread: "t1" });
  });

  it("carries nothing on a phone while only the list shows", async () => {
    setWide(false);
    render(
      <MemoryRouter initialEntries={[communicationsPath()]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: new RegExp(groupName) });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    expect(carriedChatAbout()).toBeNull();
  });
});
