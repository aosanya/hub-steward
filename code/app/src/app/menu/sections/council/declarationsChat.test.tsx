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
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { DeclarationsScreen } from "./DeclarationsScreen";
import { councilPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const zsofia = { row_id: "d1", actor_id: "a1", name: "Zsofia Varga", declared_on: "2026-03-02", answers: { "Do you own land beside the Lake Garden?": "Yes, one plot" }, own: false };
const bence = { row_id: "d2", actor_id: "a2", name: "Bence Kovacs", declared_on: "2026-03-05", answers: { "Which relatives work for the town?": "A cousin at the depot" }, own: true };

const reply = { declared: [zsofia, bence], not_declared: [{ actor_id: "a3", name: "Ilona Farkas" }], not_declared_count: 1, total: 3, can_read_all: true };

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_list_declarations") return reply;
    if (name === "agency_get_my_roles") return { permissions: [] };
    if (name === "agency_list_my_open_steps" || name === "agency_list_my_sent_steps") return { items: [] };
    throw new Error(`${name}: unknown tool`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openScreen = (wide: boolean) => {
  setWide(wide);
  render(
    <MemoryRouter initialEntries={[councilPaths.declarations.path()]}>
      <Routes>
        <Route path={councilPaths.declarations.pattern} element={<DeclarationsScreen />} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the bar and Chat on the Declarations of interest screen", () => {
  it("shows the bottom bar with Chat on a wide screen and no second title band over the opened declaration", async () => {
    openScreen(true);
    await screen.findByRole("button", { name: /Zsofia Varga/ });
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Zsofia Varga/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getAllByRole("heading", { name: "Declarations of interest" })).toHaveLength(1);
  });

  it("opens the assistant about the declaration on the screen, by the member's name", async () => {
    openScreen(true);
    await waitFor(() => expect(screen.getByRole("button", { name: /Zsofia Varga/ })).toHaveAttribute("aria-pressed", "true"));
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Zsofia Varga");
    expect(screen.getByRole("textbox", { name: "Ask about Zsofia Varga" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "declaration", id: "d1", name: "Zsofia Varga" });
    expect(carriedChatFrom()).toBe(councilPaths.declarations.path());
  });

  it("opens the assistant about the declaration chosen on a phone", async () => {
    openScreen(false);
    await userEvent.click(await screen.findByRole("button", { name: /Bence Kovacs/ }));
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Bence Kovacs");
    expect(carriedChatAbout()).toEqual({ kind: "declaration", id: "d2", name: "Bence Kovacs" });
  });

  it("carries nothing while no declaration is chosen on a phone, so Chat opens the plain assistant", async () => {
    openScreen(false);
    await screen.findByRole("button", { name: /Zsofia Varga/ });
    expect(carriedChatAbout()).toBeNull();
  });

  it("clears when the owner leaves the screen", async () => {
    openScreen(true);
    await screen.findByRole("button", { name: /Zsofia Varga/ });
    cleanup();
    await waitFor(() => expect(carriedChatAbout()).toBeNull());
  });
});
