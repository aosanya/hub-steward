import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const full = {
  id: "m1",
  answers: { Asset: "Road roller A-12", "Date done": "2026-11-12", Kind: "Repair", "What was done": "Changed the hydraulic oil", "Done by": "Road Repair Crew", Cost: "18500" },
};

const withoutWho = { id: "m2", answers: { Asset: "Road roller A-12", "Date done": "2026-11-12", Kind: "Repair", "What was done": "Replaced the lamp head" } };

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }] };
    if (tool === "agency_list_live_record_rows") return { items: [full, withoutWho] };
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

describe("the maintenance record page has the name as its title and no title band", () => {
  it("has no header band above the record title", async () => {
    show("/a/town/menu/assets/maintenance-records/m1");

    await screen.findByRole("heading", { level: 1, name: "Changed the hydraulic oil" });
    expect(document.querySelector(".head")).toBeNull();
    expect(document.querySelectorAll(".person-name")).toHaveLength(1);
  });

  it("reads the kind, the day and who did it as the one quiet line", async () => {
    show("/a/town/menu/assets/maintenance-records/m1");

    await screen.findByRole("heading", { level: 1, name: "Changed the hydraulic oil" });
    expect(document.querySelector(".quiet-line")?.textContent).toBe("Repair · Thursday, 12 Nov · Road Repair Crew");
  });

  it("leaves out who when nobody is named", async () => {
    show("/a/town/menu/assets/maintenance-records/m2");

    await screen.findByRole("heading", { level: 1, name: "Replaced the lamp head" });
    expect(document.querySelector(".quiet-line")?.textContent).toBe("Repair · Thursday, 12 Nov");
  });
});
