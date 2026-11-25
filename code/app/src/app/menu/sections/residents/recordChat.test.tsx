import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const bakery = {
  id: "b1",
  answers: { "Trading name": "Sample Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Place: "Malomsor", Neighbourhood: "Malomsor", Status: "Open", Owner: "a1" },
};

const stall = {
  id: "t1",
  answers: { "Name or alias": "Sample Honey Stall", "Kind of trader": "Street seller", "What is sold": "Honey", Neighbourhood: "Óváros", Status: "Active", Holder: "a2" },
};

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "agency" }] };
  if (name === "agency_get_my_roles") return { permissions: ["resident.read", "member.view"] };
  if (name === "agency_list_live_record_rows") return { items: given.history ? [] : [given.record_code === "RC-2" ? stall : bakery] };
  return { items: [] };
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  servedAsHub(vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args)));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const show = (entry: string, wide = true) => {
  setWide(wide);
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Chat in the bar on Businesses", () => {
  it("opens the assistant about the opened business with its owner and the details on its page", async () => {
    show(residentPaths.businesses.path({ row: "b1" }));
    await screen.findByRole("heading", { level: 1, name: "Sample Bakery" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Sample Bakery");
    expect(screen.getByRole("textbox", { name: "Ask about Sample Bakery" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({
      kind: "business",
      id: "b1",
      name: "Sample Bakery",
      extra: { owner: "a1", details: "Trading name: Sample Bakery. Kind of business: Bakery. Tax number: 10000000-1-01. Place: Malomsor. Neighbourhood: Malomsor. Status: Open" },
    });
  });

  it("comes back to the same business from the assistant", async () => {
    show(residentPaths.businesses.path({ row: "b1" }));
    await screen.findByRole("heading", { level: 1, name: "Sample Bakery" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Sample Bakery");
    expect(carriedChatFrom()).toContain(residentPaths.businesses.path({ row: "b1" }));
  });

  it("carries nothing on a phone while only the list shows", async () => {
    show(residentPaths.businesses.path(), false);
    await screen.findByText("Sample Bakery");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on Informal traders", () => {
  it("opens the assistant about the opened trader with its holder and the details on its page", async () => {
    show(residentPaths.informalTraders.path({ row: "t1" }));
    await screen.findByRole("heading", { level: 1, name: "Sample Honey Stall" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Sample Honey Stall");
    expect(carriedChatAbout()?.kind).toBe("trader");
    expect(carriedChatAbout()?.id).toBe("t1");
    expect(carriedChatAbout()?.extra?.owner).toBe("a2");
    expect(carriedChatAbout()?.extra?.details).toContain("What is sold: Honey");
    expect(carriedChatFrom()).toContain(residentPaths.informalTraders.path({ row: "t1" }));
  });
});
