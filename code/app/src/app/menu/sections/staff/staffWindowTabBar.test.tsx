import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { StaffScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const origin = { path: "/a/town/menu/staff/people", title: "Staff" };

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Staff window's bottom tab bar", () => {
  it("draws the main tab bar like every other section screen", async () => {
    openAgency("town");
    const called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => (name === "actor_get_actor" ? { id: "a1", display_name: "Anna Sample" } : name === "actor_list_actors" ? { items: [{ id: "a1", display_name: "Anna Sample" }] } : { items: [] }));
    render(
      <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/staff/people", state: { from: origin } }]}>
        <Routes>
          <Route path="/a/:agencyId/menu/staff/people" element={<StaffScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(called).toHaveBeenCalled());

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});
