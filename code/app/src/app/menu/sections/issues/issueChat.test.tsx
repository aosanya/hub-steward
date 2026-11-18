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
import { routes } from "./index";
import { issuePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const issue = { id: "i1", title: "Sample street light out", status: "open", street: "Sample Street", area: "Sample Ward", department: "Sample Works", board_item_id: "w1", raised_by: "a1", anonymous: false };

const hidden = { id: "i2", title: "Sample anonymous report", status: "open", street: "Sample Street", area: "Sample Ward", department: "Sample Works", board_item_id: "", raised_by: "a2", anonymous: true };

const wish = { id: "w1", title: "A bench by the bus stop", raised_by: 3, me_too: 2 };

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "forms" }, { module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions: ["board.manage", "resident.read"] };
  if (name === "forms_catalog_raised_item_list_nearby") return { items: [issue, hidden] };
  if (name === "forms_catalog_raised_item_list_mine") return { items: [issue] };
  if (name === "forms_catalog_setting_read") return { value: "streetlights" };
  if (name === "forms_catalog_board_item_list") return { items: [wish] };
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

const openChat = async (title: string) => {
  await screen.findByRole("heading", { level: 1, name: title });
  await userEvent.click(screen.getByRole("link", { name: "Chat" }));
  await screen.findByText(`About ${title}`);
};

describe("Chat in the bar on All Issues", () => {
  it("opens the assistant about the opened issue with its wish and the facts on its page", async () => {
    show(`${issuePaths.all.path()}?issue=i1`);
    await openChat("Sample street light out");
    expect(screen.getByRole("textbox", { name: "Ask about Sample street light out" })).toBeInTheDocument();
    expect(carriedChatAbout()?.kind).toBe("issue");
    expect(carriedChatAbout()?.id).toBe("i1");
    expect(carriedChatAbout()?.extra?.board).toBe("w1");
    expect(carriedChatAbout()?.extra?.details).toContain("Department: Sample Works");
  });

  it("comes back to the same issue from the assistant", async () => {
    show(`${issuePaths.all.path()}?issue=i1`);
    await openChat("Sample street light out");
    expect(carriedChatFrom()).toContain(`${issuePaths.all.path()}?issue=i1`);
  });

  it("never carries the name of who raised it, and none at all for an anonymous report", async () => {
    show(`${issuePaths.all.path()}?issue=i2`);
    await openChat("Sample anonymous report");
    expect(JSON.stringify(carriedChatAbout())).not.toContain("a2");
  });

  it("carries nothing on a phone while only the list shows", async () => {
    show(issuePaths.all.path(), false);
    await screen.findByText("Sample street light out");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on Assigned to Me and Map View", () => {
  it("opens the assistant about the opened issue on Assigned to Me and returns to it", async () => {
    show(`${issuePaths.assigned.path()}?issue=i1`);
    await openChat("Sample street light out");
    expect(carriedChatAbout()?.kind).toBe("issue");
    expect(carriedChatFrom()).toContain(`${issuePaths.assigned.path()}?issue=i1`);
  });

  it("opens the assistant about the opened issue on Map View and returns to it", async () => {
    show(`${issuePaths.map.path()}?issue=i1`);
    await openChat("Sample street light out");
    expect(carriedChatFrom()).toContain(`${issuePaths.map.path()}?issue=i1`);
  });
});

describe("Chat in the bar on Wishes", () => {
  it("opens the assistant about the opened wish and returns to it", async () => {
    show(`${issuePaths.wishes.path()}?wish=w1`);
    await screen.findByRole("button", { name: "Me too: A bench by the bus stop" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About A bench by the bus stop");
    expect(carriedChatAbout()).toEqual({ kind: "wish", id: "w1", name: "A bench by the bus stop", extra: { raisedBy: "3", meToo: "2" } });
    expect(carriedChatFrom()).toContain(`${issuePaths.wishes.path()}?wish=w1`);
  });
});
