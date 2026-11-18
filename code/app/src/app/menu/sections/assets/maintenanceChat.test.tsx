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
import { maintenancePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const row = {
  id: "m1",
  answers: { Asset: "Road roller A-12", "Date done": "2026-11-12", Kind: "Repair", "What was done": "Changed the hydraulic oil", "Done by": "Road Repair Crew", Cost: "18500", "Next due": "2027-05-12" },
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  setWide(true);
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: false }] };
    if (tool === "agency_list_live_record_rows") return { items: [row] };
    if (tool === "agency_get_my_roles") return { permissions: [] };
    if (tool === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetWidth();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Chat in the bar on a maintenance record's page", () => {
  it("opens the assistant about the record, named by what was done", async () => {
    open(maintenancePaths.record.path({ rowId: "m1" }));
    await screen.findByRole("heading", { level: 1, name: "Changed the hydraulic oil" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Changed the hydraulic oil");
    expect(screen.getByRole("textbox", { name: "Ask about Changed the hydraulic oil" })).toBeInTheDocument();
  });

  it("carries the record's own id and the details on its page, and comes back to the same record", async () => {
    open(maintenancePaths.record.path({ rowId: "m1" }));
    await screen.findByRole("heading", { level: 1, name: "Changed the hydraulic oil" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Changed the hydraulic oil");
    const carried = carriedChatAbout();
    expect(carried?.kind).toBe("maintenance");
    expect(carried?.id).toBe("m1");
    expect(carried?.name).toBe("Changed the hydraulic oil");
    expect(carried?.extra?.details).toBe("Asset: Road roller A-12. Date done: 2026-11-12. Kind: Repair. What was done: Changed the hydraulic oil. Done by: Road Repair Crew. Cost: 18500. Next due: 2027-05-12");
    expect(carriedChatFrom()).toBe(maintenancePaths.record.path({ rowId: "m1" }));
  });

  it("carries nothing on the list, so the Chat tab opens the plain assistant", async () => {
    open(maintenancePaths.list.path());
    await screen.findByRole("heading", { level: 1 });
    expect(carriedChatAbout()).toBeNull();
  });

  it("carries nothing when the record is not found", async () => {
    open(maintenancePaths.record.path({ rowId: "missing" }));
    await screen.findByText("This could not be loaded.");
    expect(carriedChatAbout()).toBeNull();
  });
});
