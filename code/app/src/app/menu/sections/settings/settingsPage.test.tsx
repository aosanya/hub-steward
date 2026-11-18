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
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[] = [];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "agency_list_mounts":
      return { modules: [{ module: "actor" }, { module: "comm" }, { module: "ai" }] };
    case "agency_get_my_roles":
      return { permissions };
    case "actor_list_actors":
      return { items: [{ id: "p1", display_name: "Asha Otieno" }] };
    case "actor_get_actor_standing":
      return { actor_id: "p1", display_name: "Asha Otieno", seats: [{ id: "s1", role_name: "Clerk" }, { id: "s2", role_name: "Treasurer" }] };
    case "actor_list_groups":
      return { items: [{ id: "g1", name: "North Ward" }] };
    case "actor_get_group":
      return { id: given.group_id, name: "North Ward", area_node_id: "n1" };
    case "actor_get_group_population":
      return { group_id: "g1", population: 1200 };
    case "ai_list_accounts":
      return { items: [{ id: "a1", name: "Writing helper", provider: "Anthropic", base_url: "https://models.example.org/v1", model_name: "m1", key_set: true, tokens_per_day: 1000 }] };
    case "ai_get_account":
      return { id: "a1", name: "Writing helper", provider: "Anthropic", base_url: "https://models.example.org/v1", model_name: "m1", key_set: true, tokens_per_day: 1000 };
    case "ai_list_roles":
      return { items: [{ id: "r1", name: "Council helper", status: "active", description: "Reads the agenda", tokens_per_day: 500 }] };
    default:
      return { items: [] };
  }
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  permissions = [];
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openScreen = async (title: string, query: string, name: string) => {
  setWide(true);
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[`${path}?${query}`]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name });
};

const screens = [
  { title: "Users & Roles", query: "item=p1", name: "Asha Otieno", kind: "user", id: "p1" },
  { title: "Boundaries & Areas", query: "item=g1", name: "North Ward", kind: "boundary", id: "g1" },
  { title: "Integrations", query: "item=a1", name: "Writing helper", kind: "integration", id: "a1", extra: { details: "Anthropic; Connected; Tokens per day 1,000" } },
  { title: "AI Agents & Limits", query: "item=r1", name: "Council helper", kind: "ai-agent", id: "r1", extra: { details: "Reads the agenda; Tokens per day 500" } },
];

describe.each(screens)("$title page", ({ title, query, name, kind, id, extra }) => {
  it("is titled by the chosen record, with no header band", async () => {
    await openScreen(title, query, name);
    expect(screen.queryByRole("heading", { level: 2, name: title })).not.toBeInTheDocument();
  });

  it("shows its facts in a card with a header", async () => {
    await openScreen(title, query, name);
    const cards = document.querySelectorAll(".person-page .sec");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("has the bottom bar and the Chat tab opens the assistant about it", async () => {
    await openScreen(title, query, name);
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText(`About ${name}`);
    expect(carriedChatAbout()).toEqual({ kind, id, name, ...(extra ? { extra } : {}) });
  });
});

describe("Users & Roles card acts", () => {
  it("lists the seats as rows and names the act that ends one, only for who may assign", async () => {
    permissions = ["role.assign"];
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const roles = await screen.findByRole("region", { name: "Roles" });
    expect(within(roles).getByText("Clerk")).toBeInTheDocument();
    expect(within(roles).getByRole("button", { name: "End role: Clerk" })).toBeInTheDocument();
  });

  it("hides the acts from someone without role.assign", async () => {
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const roles = await screen.findByRole("region", { name: "Roles" });
    expect(within(roles).queryByRole("button", { name: /End role/ })).not.toBeInTheDocument();
  });
});
