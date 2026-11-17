import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { items, routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const flowerStand = {
  id: "t1",
  answers: { "Name or alias": "Marika's flower stand", "What is sold": "Flowers", "Usual place": "Market square", "Usual days": "Saturday", Neighbourhood: "Óváros", Status: "Active" },
};

const chestnutRoaster = {
  id: "t2",
  answers: { "Name or alias": "Ferenc the chestnut roaster", "What is sold": "Roasted chestnuts", Neighbourhood: "Határrét" },
};

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const showInformalTraders = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.informalTraders.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Informal traders screen in Residents", () => {
  it("is a Residents menu item titled Informal traders that opens the screen", () => {
    const item = items.find((one) => one.title === "Informal traders");
    expect(item?.path?.()).toBe("/a/town/menu/residents/informal-traders");
  });

  it("lists each row of the Informal traders record with its name or alias, what is sold and neighbourhood", async () => {
    called = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [flowerStand, chestnutRoaster] });
    showInformalTraders();

    expect(await screen.findByText("Marika's flower stand")).toBeInTheDocument();
    expect(screen.getByText("Flowers · Óváros")).toBeInTheDocument();
    expect(screen.getByText("Ferenc the chestnut roaster")).toBeInTheDocument();
    expect(screen.getByText("Roasted chestnuts · Határrét")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: "RC-2" });
  });

  it("shows a card with an Add trader button inside when there are no rows, and the button goes to the new trader screen", async () => {
    const user = userEvent.setup();
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] });
    showInformalTraders();

    expect(await screen.findByText("No informal traders yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add trader" }));
    expect(landed).toBe(appRoutes.informalTraderNew.path());
    expect(landed).toBe("/a/town/menu/residents/informal-traders/new");
  });

  it.each(["agency_list_live_record_rows: record not found", "agency_list_live_record_rows: instance not found"])("treats the answer '%s' as an empty list without crashing", async (message) => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error(message));
    showInformalTraders();

    expect(await screen.findByText("No informal traders yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add trader" })).toBeInTheDocument();
  });

  it("says the list could not be loaded for any other failure", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("network down"));
    showInformalTraders();

    expect(await screen.findByRole("alert")).toHaveTextContent("This list could not be loaded.");
    expect(screen.queryByRole("button", { name: "Add trader" })).toBeNull();
  });
});
