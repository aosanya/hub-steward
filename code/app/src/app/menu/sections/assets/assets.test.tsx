import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { answerActors } from "./keeperActors";

const assetList = "assetmanager_asset_list";
const assetRead = "assetmanager_asset_read";
const locationList = "assetmanager_location_list";
const locationRead = "assetmanager_location_read";
const movementList = "assetmanager_movement_list";
const taskList = "taskmanager_task_list";
const taskRead = "taskmanager_task_read";
const repeatingList = "taskmanager_repeating_task_list";
const repeatingRead = "taskmanager_repeating_task_read";

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

const datedTasks: Record<string, string>[] = [
  { id: "d1", title: "Mend the fence", state: "To do", status: "pending", due_at: "2026-11-24T00:00:00Z" },
  { id: "d2", title: "Clear the gutters", state: "In progress", status: "in_progress" },
];

const linkedTasks: Record<string, string>[] = [
  { id: "k1", title: "Patch the Ring Road edge", state: "To do", status: "pending", due_at: "2026-11-24T00:00:00Z", linked_ref: "r1" },
  { id: "k2", title: "Service the roller", state: "In progress", status: "in_progress", linked_ref: "e1" },
  { id: "k3", title: "Clear the gutters", state: "In progress", status: "in_progress" },
  { id: "k4", title: "Check the old record", state: "To do", status: "pending", linked_ref: "nothing-here" },
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
let listed: Record<string, string>[] = tasks;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const byArgument = <T extends { id: string }>(rows: T[], args: unknown, argument: string) => {
  const given = Object.keys((args ?? {}) as object);
  if (given.length !== 1 || given[0] !== argument) throw new Error(`takes only ${argument}, got ${given.join(",") || "nothing"}`);
  return rows.find((row) => row.id === (args as Record<string, string>)[argument]);
};

const answer = (name: string, args: unknown) => {
  const actors = answerActors(name, args);
  if (actors) return actors;
  if (name === "agency_list_mounts") return Promise.resolve(mounted);
  if (name === assetList) {
    const category = (args as { category?: string } | undefined)?.category;
    return Promise.resolve({ items: category ? assets.filter((asset) => asset.category === category) : assets });
  }
  if (name === assetRead) return Promise.resolve({ item: byArgument(assets, args, "assetID") });
  if (name === locationList) return Promise.resolve({ items: locations });
  if (name === locationRead) return Promise.resolve({ item: byArgument(locations, args, "locationID") });
  if (name === movementList) return Promise.resolve({ items: movements });
  if (name === taskList) return Promise.resolve({ items: listed });
  if (name === taskRead) return Promise.resolve({ item: byArgument(listed as { id: string }[], args, "taskID") });
  if (name === repeatingList) return Promise.resolve({ items: repeating });
  if (name === repeatingRead) return Promise.resolve({ item: byArgument(repeating, args, "repeatingTaskID") });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  openAgency("town");
  listed = tasks;
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
    expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "e1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l2" });
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
    expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "e2" });
    expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l1" });
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

describe("Work Orders with a due day", () => {
  beforeEach(() => {
    listed = datedTasks;
  });

  const dueRowIn = (container: HTMLElement) => within(container).getByText("Due", { selector: ".ttl" }).closest(".row") as HTMLElement;

  it("adds the due day in words to the state in the row meta, on one line", async () => {
    showRouted("Work Orders");

    await screen.findByText("Mend the fence", { selector: ".ttl" });
    expect(metaOf(rowOf("Mend the fence"))).toEqual(["To do · due Tuesday, 24 Nov"]);
  });

  it("keeps the row meta as the state alone when there is no due day, with no blank word", async () => {
    showRouted("Work Orders");

    await screen.findByText("Clear the gutters", { selector: ".ttl" });
    expect(metaOf(rowOf("Clear the gutters"))).toEqual(["In progress"]);
  });

  it("shows a Due row with the day in words in the detail of a work order that has one", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Mend the fence/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    await within(detail).findByText("Mend the fence");
    expect(metaOf(dueRowIn(detail))).toEqual(["Tuesday, 24 Nov"]);
    expect(called).toHaveBeenCalledWith("", taskRead, { taskID: "d1" });
  });

  it("shows no Due row in the detail of a work order without a due day", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Clear the gutters/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    await within(detail).findByText("Clear the gutters");
    expect(await within(detail).findByText("In progress")).toBeInTheDocument();
    expect(within(detail).queryByText("Due")).toBeNull();
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("shows the Due row with the day in words in the right pane", async () => {
      showRouted("Work Orders");
      await userEvent.click(await screen.findByRole("button", { name: /Mend the fence/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      await within(main).findByText("Mend the fence");
      expect(metaOf(dueRowIn(main))).toEqual(["Tuesday, 24 Nov"]);
    });

    it("shows no Due row in the right pane for a work order without a due day", async () => {
      showRouted("Work Orders");
      await userEvent.click(await screen.findByRole("button", { name: /Clear the gutters/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      await within(main).findByText("Clear the gutters");
      expect(within(main).queryByText("Due")).toBeNull();
    });
  });
});

describe("Work Orders linked to an asset", () => {
  beforeEach(() => {
    listed = linkedTasks;
  });

  const findRowIn = async (container: HTMLElement, title: string) =>
    (await within(container).findByText(title, { selector: ".ttl" })).closest(".row") as HTMLElement;

  it("adds the place of the linked asset to the row meta after the state and the due day, on one line", async () => {
    showRouted("Work Orders");

    await screen.findByText("Patch the Ring Road edge", { selector: ".ttl" });
    expect(metaOf(rowOf("Patch the Ring Road edge"))).toEqual(["To do · due Tuesday, 24 Nov · North Depot"]);
  });

  it("adds the place straight after the state when the job has a linked asset but no due day", async () => {
    showRouted("Work Orders");

    await screen.findByText("Service the roller", { selector: ".ttl" });
    expect(metaOf(rowOf("Service the roller"))).toEqual(["In progress · Riverside Yard"]);
  });

  it("keeps the row meta as it was for a job with no linked asset", async () => {
    showRouted("Work Orders");

    await screen.findByText("Clear the gutters", { selector: ".ttl" });
    expect(metaOf(rowOf("Clear the gutters"))).toEqual(["In progress"]);
  });

  it("adds nothing to the row meta when the linked asset is not in the asset list", async () => {
    showRouted("Work Orders");

    await screen.findByText("Check the old record", { selector: ".ttl" });
    expect(metaOf(rowOf("Check the old record"))).toEqual(["To do"]);
    expect(rowTitles()).toEqual(["Patch the Ring Road edge", "Service the roller", "Clear the gutters", "Check the old record"]);
  });

  it("asks for the asset list and the location list once each for the whole list of work orders", async () => {
    showRouted("Work Orders");
    await screen.findByText("Patch the Ring Road edge", { selector: ".ttl" });

    expect(callsTo(assetList)).toHaveLength(1);
    expect(callsTo(locationList)).toHaveLength(1);
    expect(callsTo(assetRead)).toHaveLength(0);
    expect(callsTo(locationRead)).toHaveLength(0);
  });

  it("shows About with the asset's name and Place with its place, after the Due row, in the detail", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Patch the Ring Road edge/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    await within(detail).findByText("Patch the Ring Road edge");
    expect(metaOf(await findRowIn(detail, "About"))).toEqual(["Ring Road"]);
    expect(metaOf(await findRowIn(detail, "Place"))).toEqual(["North Depot"]);
    const titles = Array.from(detail.querySelectorAll(".row .ttl")).map((title) => title.textContent);
    expect(titles.indexOf("About")).toBeGreaterThan(titles.indexOf("Due"));
    expect(titles.indexOf("Place")).toBeGreaterThan(titles.indexOf("About"));
    expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "r1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l1" });
  });

  it("shows the other asset and its place for a job linked to another asset", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Service the roller/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(metaOf(await findRowIn(detail, "About"))).toEqual(["Road roller"]);
    expect(metaOf(await findRowIn(detail, "Place"))).toEqual(["Riverside Yard"]);
    expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "e1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l2" });
  });

  it("shows no About and no Place row, and reads no asset, for a job with no linked asset", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Clear the gutters/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    await within(detail).findByText("Clear the gutters");
    expect(await within(detail).findByText("In progress")).toBeInTheDocument();
    expect(within(detail).queryByText("About")).toBeNull();
    expect(within(detail).queryByText("Place")).toBeNull();
    expect(callsTo(assetRead)).toHaveLength(0);
    expect(callsTo(locationRead)).toHaveLength(0);
  });

  it("shows neither row, and does not crash, when the linked asset cannot be found", async () => {
    showRouted("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Check the old record/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    await within(detail).findByText("Check the old record");
    expect(await within(detail).findByText("To do")).toBeInTheDocument();
    expect(within(detail).queryByText("About")).toBeNull();
    expect(within(detail).queryByText("Place")).toBeNull();
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("shows About and Place in the right pane after the Due row", async () => {
      showRouted("Work Orders");
      await userEvent.click(await screen.findByRole("button", { name: /Patch the Ring Road edge/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      await within(main).findByText("Patch the Ring Road edge");
      expect(metaOf(await findRowIn(main, "About"))).toEqual(["Ring Road"]);
      expect(metaOf(await findRowIn(main, "Place"))).toEqual(["North Depot"]);
      const titles = Array.from(main.querySelectorAll(".row .ttl")).map((title) => title.textContent);
      expect(titles.indexOf("About")).toBeGreaterThan(titles.indexOf("Due"));
      expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "r1" });
      expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l1" });
    });

    it("shows no About and no Place row in the right pane for a job with no linked asset", async () => {
      showRouted("Work Orders");
      await userEvent.click(await screen.findByRole("button", { name: /Clear the gutters/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      await within(main).findByText("Clear the gutters");
      expect(within(main).queryByText("About")).toBeNull();
      expect(within(main).queryByText("Place")).toBeNull();
      expect(callsTo(assetRead)).toHaveLength(0);
    });

    it("shows neither row in the right pane when the linked asset cannot be found", async () => {
      showRouted("Work Orders");
      await userEvent.click(await screen.findByRole("button", { name: /Check the old record/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      await within(main).findByText("Check the old record");
      expect(within(main).queryByText("About")).toBeNull();
      expect(within(main).queryByText("Place")).toBeNull();
    });
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

  it("opens the chosen schedule in the detail with its title, how often and the raw rule", async () => {
    showRouted("Maintenance Schedule");
    await userEvent.click(await screen.findByRole("button", { name: /Inspect the playground/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("Every 2 weeks")).toBeInTheDocument();
    expect(within(detail).getByText("Inspect the playground")).toBeInTheDocument();
    expect(within(detail).getByText("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE")).toBeInTheDocument();
    expect(callsTo(repeatingRead)[0][2]).toEqual({ repeatingTaskID: "p4" });
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("keeps the list on the left, opens the chosen schedule in the right pane and draws no tab bar", async () => {
      showRouted("Maintenance Schedule");
      await userEvent.click(await screen.findByRole("button", { name: /Grease the pumps/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("FREQ=WEEKLY")).toBeInTheDocument();
      expect(within(main).getByText("Weekly")).toBeInTheDocument();
      expect(within(main).getByText("Grease the pumps")).toBeInTheDocument();
      expect(within(document.querySelector(".wf-tree") as HTMLElement).getByRole("button", { name: /Inspect the fire exits/ })).toBeInTheDocument();
      expect(document.querySelector("nav.tabs")).toBeNull();
    });

    it("leaves the right pane empty until a schedule is chosen", async () => {
      showRouted("Maintenance Schedule");
      await screen.findByText("Grease the pumps", { selector: ".ttl" });

      expect(document.querySelector(".wf-main")?.textContent).toBe("");
      expect(callsTo(repeatingRead)).toHaveLength(0);
    });
  });
});

describe("who keeps an asset", () => {
  const keeperOf = (_title: string) => screen.queryByText("Kept by", { selector: ".ttl" })?.closest(".row")?.querySelector(".meta")?.textContent ?? null;

  const settle = async () => {
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => String(tool).startsWith("actor_"))).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
  };

  const keep = (index: number, keeper: string) => Object.assign(assets[index], { attributes_json: JSON.stringify({ condition: "Good", keeper }) });

  afterEach(() => {
    for (const asset of assets) delete (asset as Record<string, unknown>).attributes_json;
  });

  it("shows the person who keeps a piece of equipment under Kept by, after Condition", async () => {
    keep(2, "p1");
    showRouted("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));

    await waitFor(() => expect(keeperOf("Road roller")).toBe("Nagy Réka"));
    const condition = screen.getByText("Condition", { selector: ".ttl" });
    const keeper = screen.getByText("Kept by", { selector: ".ttl" });
    expect(Boolean(condition.compareDocumentPosition(keeper) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("shows the group that keeps a facility", async () => {
    keep(4, "g3");
    showRouted("Facilities");
    await userEvent.click(await screen.findByRole("button", { name: /Swimming pool/ }));

    await waitFor(() => expect(keeperOf("Swimming pool")).toBe("Public Works Department"));
  });

  it("shows no Kept by row for an asset nobody keeps", async () => {
    showRouted("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Water pump/ }));

    await screen.findByText("A-13");
    expect(screen.queryByText("Kept by")).toBeNull();
  });

  it("shows no Kept by row when the keeper is not a person or group of the hub", async () => {
    keep(2, "zz9");
    showRouted("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));

    await screen.findByText("A-12");
    await settle();
    expect(screen.queryByText("Kept by")).toBeNull();
    expect(screen.getAllByText("Road roller").length).toBeGreaterThan(1);
  });

  it("keeps the lists as they were: the keeper never reaches a row", async () => {
    keep(2, "g1");
    showRouted("Equipment");

    await screen.findByText("Road roller", { selector: ".ttl" });
    expect(metaOf(rowOf("Road roller"))).toEqual(["Riverside Yard"]);
    expect(screen.queryByText("Street Lighting Crew")).toBeNull();
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("shows Kept by with the name in the right pane", async () => {
      keep(2, "p2");
      showRouted("Equipment");
      await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("Kept by")).toBeInTheDocument();
      expect(await within(main).findByText("Gábor Horváth")).toBeInTheDocument();
    });

    it("shows no Kept by row in the right pane for an asset nobody keeps", async () => {
      showRouted("Equipment");
      await userEvent.click(await screen.findByRole("button", { name: /Water pump/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("A-13")).toBeInTheDocument();
      expect(within(main).queryByText("Kept by")).toBeNull();
    });
  });
});
