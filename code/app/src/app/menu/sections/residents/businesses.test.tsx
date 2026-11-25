import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { registersHub } from "../../registerHub.test-support";
import { routes as appRoutes } from "../../../routes";
import { items, routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const bakery = {
  id: "b1",
  answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Place: "Malomsor", Neighbourhood: "Malomsor", Status: "Open" },
};

const grocer = {
  id: "b2",
  answers: { "Trading name": "Zöldkert Grocer", "Kind of business": "Grocer", Neighbourhood: "Óváros" },
};

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const showBusinesses = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.businesses.path()]}>
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

describe("the Businesses screen in Residents", () => {
  it("is a Residents menu item titled Businesses that opens the screen", () => {
    const item = items.find((one) => one.title === "Businesses");
    expect(item?.path?.()).toBe("/a/town/menu/residents/businesses");
  });

  it("lists each row of the Businesses record with its trading name, kind of business and neighbourhood", async () => {
    ({ hub: called } = registersHub({ businesses: [bakery, grocer] }));
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    expect(screen.getByText("Bakery · Malomsor")).toBeInTheDocument();
    expect(screen.getByText("Zöldkert Grocer")).toBeInTheDocument();
    expect(screen.getByText("Grocer · Óváros")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: "RC-1" });
  });

  it("shows a card with an Add business button inside when there are no rows, and the button goes to the new business screen", async () => {
    const user = userEvent.setup();
    registersHub();
    showBusinesses();

    expect(await screen.findByText("No businesses yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add business" }));
    expect(landed).toBe(appRoutes.businessNew.path());
    expect(landed).toBe("/a/town/menu/residents/businesses/new");
  });

  it.each(["agency_list_live_record_rows: record not found", "agency_list_live_record_rows: instance not found"])("treats the answer '%s' as an empty list without crashing", async (message) => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error(message));
    showBusinesses();

    expect(await screen.findByText("No businesses yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add business" })).toBeInTheDocument();
  });

  it("says the list could not be loaded for any other failure", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("network down"));
    showBusinesses();

    expect(await screen.findByRole("alert")).toHaveTextContent("This list could not be loaded.");
    expect(screen.queryByRole("button", { name: "Add business" })).toBeNull();
  });
});
