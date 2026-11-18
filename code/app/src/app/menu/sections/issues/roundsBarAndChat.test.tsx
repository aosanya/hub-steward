import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, forgetChatAbout } from "../../../chatAbout";
import { RoundsByNeighbourhoodScreen } from "./RoundsByNeighbourhoodScreen";
import { issuePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const answer = async (name: string) => {
  if (name === "actor_list_groups") return { items: [{ id: "g-mal", name: "Malomsor", node_type: "Városrész" }] };
  if (name === "actor_list_levels") return { items: [{ id: "l2", name: "Városrész", depth: 1, is_area: true }] };
  if (name === "forms_form_list") return { rows: [] };
  if (name === "actor_get_group_population") return { population: 8 };
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

describe.each([
  { label: "wide", wide: true },
  { label: "phone", wide: false },
])("Rounds by Neighbourhood on a $label screen", ({ wide }) => {
  const open = async () => {
    setWide(wide);
    render(
      <MemoryRouter initialEntries={[issuePaths.rounds.path()]}>
        <Routes>
          <Route path={issuePaths.rounds.pattern} element={<RoundsByNeighbourhoodScreen />} />
          <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
        </Routes>
      </MemoryRouter>,
    );
    if (!wide) await userEvent.click(await screen.findByRole("button", { name: /Malomsor/ }));
    await waitFor(() => expect(document.querySelector(".mw-detail")?.textContent).toContain("Malomsor"));
  };

  it("draws the bottom bar with Home and Chat", async () => {
    await open();
    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "Chat" })).toBeInTheDocument();
  });

  it("shows the title once, with no band above the list", async () => {
    await open();
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(screen.getAllByRole("heading", { name: "Rounds by Neighbourhood" })).toHaveLength(1);
  });

  it("opens the assistant about the neighbourhood on screen from the Chat tab", async () => {
    await open();
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Malomsor");
    expect(carriedChatAbout()).toEqual({ kind: "rounds", id: "g-mal", name: "Malomsor" });
  });
});
