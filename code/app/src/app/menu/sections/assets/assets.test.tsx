import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const assetList = "assetmanager_asset_list";
const assetRead = "assetmanager_asset_read";
const locationList = "assetmanager_location_list";
const locationRead = "assetmanager_location_read";
const movementList = "assetmanager_movement_list";
const taskList = "taskmanager_task_list";
const repeatingList = "taskmanager_repeating_task_list";

const locations = [
  { id: "l1", code: "L-1", name: "North Depot", kind: "depot" },
  { id: "l2", code: "L-2", name: "Riverside Yard", kind: "yard" },
  { id: "l3", code: "L-3", name: "Civic Centre", kind: "building" },
];

const assets = [
  { id: "r1", code: "A-1", name: "Ring Road", category: "Route", location_id: "l1" },
  { id: "r2", code: "A-2", name: "Harbour Lane", category: "Route", location_id: "l2" },
  { id: "e1", code: "A-12", name: "Road roller", category: "Equipment", location_id: "l2" },
  { id: "e2", code: "A-13", name: "Water pump", category: "Equipment", location_id: "l1" },
  { id: "f1", code: "A-20", name: "Swimming pool", category: "Facility", location_id: "l3" },
  { id: "f2", code: "A-21", name: "Sports hall", category: "Facility", location_id: "l1" },
  { id: "b1", code: "A-30", name: "Town hall", category: "Building", location_id: "l3" },
  { id: "b2", code: "A-31", name: "Library", category: "Building", location_id: "l2" },
];

const movements = [
  { id: "m1", asset_id: "e1", kind: "arrived", to_location_id: "l1", note: "Delivered from the supplier", occurred_at: "2026-01-05T08:00:00Z" },
  { id: "m2", asset_id: "e1", kind: "transferred", from_location_id: "l1", to_location_id: "l2", note: "Sent to the workshop", occurred_at: "2026-03-02T08:00:00Z" },
  { id: "m3", asset_id: "e1", kind: "transferred", from_location_id: "l2", to_location_id: "l1", note: "Lent to the parks crew", occurred_at: "2026-05-11T08:00:00Z" },
  { id: "m4", asset_id: "e1", kind: "transferred", from_location_id: "l1", to_location_id: "l3", note: "Shown at the open day", occurred_at: "2026-08-19T08:00:00Z" },
  { id: "m5", asset_id: "e1", kind: "transferred", from_location_id: "l3", to_location_id: "l1", note: "Back from the open day", occurred_at: "2026-09-23T08:00:00Z" },
  { id: "m6", asset_id: "e1", kind: "transferred", from_location_id: "l1", to_location_id: "l2", note: "Parked at the yard", occurred_at: "2026-11-10T08:00:00Z" },
];

const tasks = [
  { id: "t1", title: "Repair the culvert", state: "In progress", status: "in_progress" },
  { id: "t2", title: "Repaint the bus shelter", state: "To do", status: "pending" },
  { id: "t3", title: "Replace the bridge rail", state: "Done", status: "completed" },
];

const repeating = [
  { id: "p1", title: "Grease the pumps", schedule_rule: "FREQ=WEEKLY" },
  { id: "p2", title: "Inspect the fire exits", schedule_rule: "FREQ=MONTHLY" },
  { id: "p3", title: "Sweep the market square", schedule_rule: "FREQ=DAILY" },
  { id: "p4", title: "Inspect the playground", schedule_rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE" },
  { id: "p5", title: "Service the boiler", schedule_rule: "FREQ=MONTHLY;INTERVAL=3" },
  { id: "p6", title: "Check the hydrants", schedule_rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO" },
];

const mounted = { modules: [{ module: "assetmanager" }, { module: "taskmanager" }] };

const origin = { path: "/a/town/menu/assets", title: "Assets & Works" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const byId = <T extends { id: string }>(rows: T[], args: unknown) => rows.find((row) => row.id === (args as { id: string }).id);

const answer = (name: string, args: unknown) => {
  if (name === "agency_list_mounts") return Promise.resolve(mounted);
  if (name === assetList) {
    const category = (args as { category?: string } | undefined)?.category;
    return Promise.resolve({ items: category ? assets.filter((asset) => asset.category === category) : assets });
  }
  if (name === assetRead) return Promise.resolve({ item: byId(assets, args) });
  if (name === locationList) return Promise.resolve({ items: locations });
  if (name === locationRead) return Promise.resolve({ item: byId(locations, args) });
  if (name === movementList) return Promise.resolve({ items: movements });
  if (name === taskList) return Promise.resolve({ items: tasks });
  if (name === repeatingList) return Promise.resolve({ items: repeating });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pathOf = (title: string) => items.find((item) => item.title === title)?.path?.() ?? "";

const showRouted = (title: string, came = true) =>
  render(
    <MemoryRouter initialEntries={[came ? { pathname: pathOf(title), state: { from: origin } } : pathOf(title)]}>
      <Routes>{routes()}</Routes>
      <Where />
    </MemoryRouter>,
  );

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

const metaOf = (row: HTMLElement) => Array.from(row.querySelectorAll(".meta")).map((line) => line.textContent);

const rowTitles = () => Array.from(document.querySelectorAll(".row .ttl")).map((title) => title.textContent);

const before = (first: string, second: string) => {
  const one = screen.getByText(first);
  const two = screen.getByText(second);
  return Boolean(one.compareDocumentPosition(two) & Node.DOCUMENT_POSITION_FOLLOWING);
};

describe("the Assets and Works section items", () => {
  it("lists Routes, Equipment, Facilities, Buildings, Work Orders and Maintenance Schedule, each opening its own screen", () => {
    expect(items.map((item) => item.title)).toEqual(["Routes", "Equipment", "Facilities", "Buildings", "Work Orders", "Maintenance Schedule"]);
    for (const item of items) expect(typeof item.path?.()).toBe("string");
    expect(new Set(items.map((item) => item.path?.())).size).toBe(items.length);
  });
});

describe.each([
  ["Routes", "Route", [["Ring Road", "North Depot"], ["Harbour Lane", "Riverside Yard"]], ["Road roller", "Swimming pool", "Town hall"]],
  ["Equipment", "Equipment", [["Road roller", "Riverside Yard"], ["Water pump", "North Depot"]], ["Ring Road", "Swimming pool", "Town hall"]],
  ["Facilities", "Facility", [["Swimming pool", "Civic Centre"], ["Sports hall", "North Depot"]], ["Ring Road", "Road roller", "Town hall"]],
  ["Buildings", "Building", [["Town hall", "Civic Centre"], ["Library", "Riverside Yard"]], ["Ring Road", "Road roller", "Swimming pool"]],
])("%s", (title, category, rows, others) => {
  it("lists only the assets of its category, each with the location it is at", async () => {
    showRouted(title);

    await screen.findByText(rows[0][0], { selector: ".ttl" });
    for (const [name, place] of rows) expect(metaOf(rowOf(name))).toEqual([place]);
    for (const name of others) expect(screen.queryByText(name)).toBeNull();
    expect(rowTitles()).toEqual(rows.map(([name]) => name));
  });

  it("asks the asset list for its category and matches each location from the location list", async () => {
    showRouted(title);
    await screen.findByText(rows[0][0], { selector: ".ttl" });

    expect(callsTo(assetList).some(([, , args]) => (args as { category?: string }).category === category)).toBe(true);
    expect(callsTo(locationList)).not.toHaveLength(0);
  });

  it("names the screen the person came from on the Back button of the list", async () => {
    showRouted(title);
    await screen.findByText(rows[0][0], { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: "‹ Assets & Works" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("draws its title under the bar, so it does not run over Back", async () => {
    showRouted(title);
    await screen.findByText(rows[0][0], { selector: ".ttl" });

    expect(document.querySelector(".bar-title")).toBeNull();
    expect(document.querySelector("h1.headline")).toHaveTextContent(title);
  });
});

describe("an asset detail", () => {
  const openRoller = async () => {
    showRouted("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
  };

  it("opens from a row with the asset's name, code, category and location", async () => {
    await openRoller();

    expect(await screen.findByText("A-12")).toBeInTheDocument();
    expect(screen.getAllByText("Road roller").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Equipment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Riverside Yard").length).toBeGreaterThan(1);
    expect(called).toHaveBeenCalledWith("", assetRead, { id: "e1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { id: "l2" });
  });

  it("marks the chosen row and leaves the rest of the list beside it", async () => {
    await openRoller();
    await screen.findByText("A-12");

    expect(screen.getByRole("button", { name: /Road roller/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Water pump/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("lists the newest few movements of that asset, newest first, and not the oldest", async () => {
    await openRoller();

    expect(await screen.findByText("Parked at the yard")).toBeInTheDocument();
    expect(screen.getByText("Back from the open day")).toBeInTheDocument();
    expect(before("Parked at the yard", "Back from the open day")).toBe(true);
    expect(screen.queryByText("Delivered from the supplier")).toBeNull();
    expect(callsTo(movementList).some(([, , args]) => (args as { asset_id?: string }).asset_id === "e1")).toBe(true);
  });

  it("opens another asset's detail when another row is chosen", async () => {
    await openRoller();
    await screen.findByText("A-12");

    await userEvent.click(screen.getByRole("button", { name: /Water pump/ }));

    expect(await screen.findByText("A-13")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", assetRead, { id: "e2" });
    expect(called).toHaveBeenCalledWith("", locationRead, { id: "l1" });
  });

  it("names the list on the Back button of the detail and returns to the list", async () => {
    await openRoller();
    await screen.findByText("A-12");

    await userEvent.click(screen.getByRole("button", { name: "‹ Equipment" }));

    expect(await screen.findByRole("button", { name: /Water pump/ })).toBeInTheDocument();
    expect(screen.queryByText("A-12")).toBeNull();
    expect(screen.queryByText("Parked at the yard")).toBeNull();
  });

  it("draws its title under the bar, so it does not run over Back", async () => {
    await openRoller();
    await screen.findByText("A-12");

    expect(document.querySelector(".bar-title")).toBeNull();
  });
});

describe("Work Orders", () => {
  it("lists each task with its title and its state, and leaves out what is Done", async () => {
    showRouted("Work Orders");

    await screen.findByText("Repair the culvert", { selector: ".ttl" });
    expect(metaOf(rowOf("Repair the culvert"))).toEqual(["In progress"]);
    expect(metaOf(rowOf("Repaint the bus shelter"))).toEqual(["To do"]);
    expect(screen.queryByText("Replace the bridge rail")).toBeNull();
    expect(rowTitles()).toEqual(["Repair the culvert", "Repaint the bus shelter"]);
    expect(callsTo(taskList)).not.toHaveLength(0);
    expect(callsTo(assetList)).toHaveLength(0);
  });

  it("names the screen the person came from on the Back button", async () => {
    showRouted("Work Orders");
    await screen.findByText("Repair the culvert", { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: "‹ Assets & Works" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });
});

describe("Maintenance Schedule", () => {
  it("lists each repeating task with its title and how often it repeats", async () => {
    showRouted("Maintenance Schedule");

    await screen.findByText("Grease the pumps", { selector: ".ttl" });
    expect(metaOf(rowOf("Grease the pumps"))).toEqual(["Weekly"]);
    expect(metaOf(rowOf("Inspect the fire exits"))).toEqual(["Monthly"]);
    expect(metaOf(rowOf("Sweep the market square"))).toEqual(["Daily"]);
    expect(callsTo(repeatingList)).not.toHaveLength(0);
    expect(callsTo(taskList)).toHaveLength(0);
  });

  it("says every 2 weeks for a rule with an interval and keeps the plain word for an interval of 1", async () => {
    showRouted("Maintenance Schedule");

    await screen.findByText("Inspect the playground", { selector: ".ttl" });
    expect(metaOf(rowOf("Inspect the playground"))).toEqual(["Every 2 weeks"]);
    expect(metaOf(rowOf("Service the boiler"))).toEqual(["Every 3 months"]);
    expect(metaOf(rowOf("Check the hydrants"))).toEqual(["Weekly"]);
  });

  it("names the screen the person came from on the Back button", async () => {
    showRouted("Maintenance Schedule");
    await screen.findByText("Grease the pumps", { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: "‹ Assets & Works" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("keeps its long title out of the bar, under it, so it does not run over Back", async () => {
    showRouted("Maintenance Schedule");
    await screen.findByText("Grease the pumps", { selector: ".ttl" });

    const bar = document.querySelector("header.bar") as HTMLElement;
    expect(bar).toHaveTextContent("‹ Assets & Works");
    expect(bar).not.toHaveTextContent("Maintenance Schedule");
    expect(document.querySelector(".bar-title")).toBeNull();
    expect(document.querySelector("h1.headline")).toHaveTextContent("Maintenance Schedule");
  });
});
