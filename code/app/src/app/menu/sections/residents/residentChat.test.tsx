import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { askAssistant, type AssistantClient } from "../../../../features/assistant/api";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, chatAboutWords, forgetChatAbout } from "../../../chatAbout";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const resident = { id: "p1", name: "Takács Erzsébet" };

let permissions: string[] = ["resident.read"];

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_actors") return { items: [{ id: resident.id, display_name: resident.name, status: "active" }] };
  if (name === "actor_get_actor") return { id: resident.id, display_name: resident.name, status: "active" };
  if (name === "ai_chat_account") return { message: { content: "ok" } };
  return { items: [] };
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

let calls: { name: string; args: unknown }[] = [];

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  permissions = ["resident.read"];
  calls = [];
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    calls.push({ name, args });
    return answer(name);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

function ChatList() {
  return <p>the general chat</p>;
}

const openPeople = async (wide: boolean, pick: boolean) => {
  setWide(wide);
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path="/a/:agencyId/chat" element={<ChatList />} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  if (pick && !wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(resident.name) }));
  if (pick) await screen.findByText("Bills");
  else await screen.findByRole("button", { name: new RegExp(resident.name) });
};


const chatTab = () => screen.getByRole("link", { name: "Chat" });

const sentToTheModel = async () => {
  calls = [];
  await askAssistant("acc1", [{ role: "user", content: "what does this resident owe?" }]);
  const chat = calls.find((call) => call.name === "ai_chat_account");
  return JSON.stringify((chat?.args as { messages: unknown }).messages);
};

describe("the All Residents page carries the bottom navigation bar", () => {
  it("shows Home, Chat and Notifications on a phone", async () => {
    await openPeople(false, false);
    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home", "Chat", "Notifications"]);
  });

  it("shows the same bar on a computer, in place of the empty status strip", async () => {
    await openPeople(true, false);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(document.querySelector(".wf-status")).toBeNull();
  });
});

const aboutLine = () => screen.findByText(`About ${resident.name}`);

describe("Chat in the bar with a resident open opens the assistant about that resident", () => {
  it("lands on the assistant conversation with the About line and the composer ready", async () => {
    await openPeople(true, true);
    await userEvent.click(chatTab());
    await aboutLine();
    expect(screen.getByRole("textbox", { name: `Ask about ${resident.name}` })).toBeInTheDocument();
    expect(screen.queryByText("the general chat")).toBeNull();
  });

  it("hands the assistant the resident's id and name", async () => {
    await openPeople(true, true);
    await userEvent.click(chatTab());
    await aboutLine();
    expect(carriedChatAbout()).toEqual({ kind: "resident", id: resident.id, name: resident.name });
    const sent = await sentToTheModel();
    expect(sent).toContain(resident.name);
    expect(sent).toContain(resident.id);
    expect(chatAboutWords({ kind: "resident", ...resident })).toContain(resident.name);
  });

  it("creates no thread about the resident", async () => {
    await openPeople(true, true);
    await userEvent.click(chatTab());
    await aboutLine();
    expect(calls.filter((call) => call.name === "comm_chat_thread_create")).toEqual([]);
  });

  it("works from the phone bar too", async () => {
    await openPeople(false, true);
    await userEvent.click(chatTab());
    await aboutLine();
    expect(carriedChatAbout()?.id).toBe(resident.id);
  });

  it("clearing the line removes it and the assistant no longer holds the resident", async () => {
    await openPeople(false, true);
    await userEvent.click(chatTab());
    await aboutLine();
    await userEvent.click(screen.getByRole("button", { name: `Clear About ${resident.name}` }));
    await waitFor(() => expect(screen.queryByText(`About ${resident.name}`)).toBeNull());
    expect(carriedChatAbout()).toBeNull();
    expect(await sentToTheModel()).not.toContain(resident.name);
  });

  it("Back returns to the resident's page", async () => {
    await openPeople(false, true);
    await userEvent.click(chatTab());
    await aboutLine();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    await screen.findByText("Bills");
  });
});

describe("Chat in the bar with no resident to carry", () => {
  it("is the usual chat with no resident context when none is open", async () => {
    await openPeople(false, false);
    await userEvent.click(chatTab());
    await screen.findByText("the general chat");
    expect(carriedChatAbout()).toBeNull();
    expect(screen.queryByText(/^About /)).toBeNull();
    expect(await sentToTheModel()).not.toContain(resident.name);
  });

  it("carries nothing once the resident is closed on a phone", async () => {
    await openPeople(false, true);
    await userEvent.click(screen.getByRole("button", { name: /All People/ }));
    await waitFor(() => expect(screen.queryByText("Bills")).toBeNull());
    await userEvent.click(chatTab());
    await screen.findByText("the general chat");
    expect(carriedChatAbout()).toBeNull();
  });

  it("carries nothing for someone without resident.read, even with a resident open", async () => {
    permissions = [];
    await openPeople(true, true);
    await userEvent.click(chatTab());
    await screen.findByText("the general chat");
    expect(carriedChatAbout()).toBeNull();
  });
});
