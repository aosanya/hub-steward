import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { routes } from "./index";
import { staffPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const show = () =>
  render(
    <MemoryRouter initialEntries={[staffPaths.people.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  permissions = ["member.add"];
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "actor_list_actors") return { items: [{ id: "a1", display_name: "Rita Kovacs" }] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Staff list", () => {
  it("carries the full-width Add person button above Search for a holder of member.add", async () => {
    show();
    const button = await screen.findByRole("button", { name: "Add person" });
    const search = await screen.findByLabelText("Search");
    expect(button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Add person button without member.add", async () => {
    permissions = [];
    show();
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    await screen.findAllByText(/Home/);
    expect(screen.queryByRole("button", { name: "Add person" })).not.toBeInTheDocument();
  });

  it("opens the one person Add screen", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Add person" }));
    await waitFor(() => expect(landed).toBe(appRoutes.personNew.path()));
  });
});
