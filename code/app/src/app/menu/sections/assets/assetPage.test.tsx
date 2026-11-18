import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { answerActors } from "./keeperActors";

const assets = [
  { id: "e1", code: "A-12", name: "Road roller", category: "Equipment", location_id: "l2" },
  { id: "r1", code: "A-1", name: "Ring Road", category: "Route", location_id: "l1" },
];
const locations = [
  { id: "l1", name: "North Depot" },
  { id: "l2", name: "Riverside Yard" },
];
const movements = [{ id: "m1", asset_id: "e1", kind: "arrived", note: "Parked at the yard", occurred_at: "2026-11-10T08:00:00Z" }];
const tasks = [
  { id: "t1", title: "Repair the culvert", state: "In progress", status: "in_progress", due_at: "2026-11-24T00:00:00Z", linked_ref: "e1" },
  { id: "h1", title: "Grease the roller hydraulics", state: "Done", status: "completed", linked_ref: "e1", completed_at: "2026-11-03T09:30:00Z" },
];
const repeating = [{ id: "p1", title: "Grease the pumps", schedule_rule: "FREQ=WEEKLY" }];

let permissions: string[];

const byId = (rows: { id: string }[], args: unknown, key: string) => rows.find((row) => row.id === (args as Record<string, string>)[key]);

const answer = (name: string, args: unknown): Promise<unknown> => {
  const actors = answerActors(name, args);
  if (actors) return actors;
  if (name === "agency_get_my_roles") return Promise.resolve({ permissions });
  if (name === "agency_list_mounts") return Promise.resolve({ modules: [{ module: "assetmanager" }, { module: "taskmanager" }] });
  if (name === "assetmanager_asset_list") return Promise.resolve({ items: assets.filter((asset) => asset.category === (args as { category?: string })?.category) });
  if (name === "assetmanager_asset_read") return Promise.resolve({ item: byId(assets, args, "assetID") });
  if (name === "assetmanager_location_list") return Promise.resolve({ items: locations });
  if (name === "assetmanager_location_read") return Promise.resolve({ item: byId(locations, args, "locationID") });
  if (name === "assetmanager_movement_list") return Promise.resolve({ items: movements });
  if (name === "taskmanager_task_list") return Promise.resolve({ items: tasks });
  if (name === "taskmanager_task_read") return Promise.resolve({ item: byId(tasks, args, "taskID") });
  if (name === "taskmanager_agent_list") return Promise.resolve({ items: [] });
  if (name === "taskmanager_repeating_task_list") return Promise.resolve({ items: repeating });
  if (name === "taskmanager_repeating_task_read") return Promise.resolve({ item: byId(repeating, args, "repeatingTaskID") });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  permissions = ["asset.manage", "task.edit"];
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetWidth();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (title: string) =>
  render(
    <MemoryRouter initialEntries={[items.find((item) => item.title === title)?.path?.() ?? ""]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const cardOf = (word: string) => screen.getByRole("region", { name: word });

describe("an asset opens as a page of cards, as the resident does", () => {
  it("shows the name as the page title with the category as the quiet line and no header band", async () => {
    show("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    const title = await screen.findByRole("heading", { level: 1, name: "Road roller" });
    expect(title.closest(".person-page")?.querySelector(".quiet-line")?.textContent).toContain("Equipment");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("has an Asset detail card with plain rows and Edit and no stacked Edit button below the cards", async () => {
    show("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    const card = await screen.findByRole("region", { name: "Asset detail" });
    expect(card.textContent).toContain("A-12");
    expect(card.textContent).toContain("Riverside Yard");
    expect(card.querySelector(".lead")).toBeNull();
    expect(card.querySelector(".sec-foot")?.textContent).toContain("Edit");
  });

  it("lists the movements and the finished work orders as cards of their own", async () => {
    show("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    expect(await within(await screen.findByRole("region", { name: "Movements" })).findByText("Parked at the yard")).toBeInTheDocument();
    expect(within(cardOf("Finished work orders")).getByText(/Grease the roller hydraulics/)).toBeInTheDocument();
  });

  it("draws no act that the app does not have: no add movement and no raise work order", async () => {
    show("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    await screen.findByRole("region", { name: "Asset detail" });
    expect(screen.queryByRole("button", { name: /add movement|raise work order/i })).toBeNull();
  });

  it("hides Edit from a reader without asset.manage", async () => {
    permissions = [];
    show("Equipment");
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    await screen.findByRole("region", { name: "Asset detail" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("has the bottom bar", async () => {
    show("Equipment");
    await screen.findByRole("button", { name: /Road roller/ });
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
  });
});

describe("a work order opens as a page of cards", () => {
  it("shows the title, a Work order card with Edit and Change state in its footer, and an Assignee card", async () => {
    show("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Repair the culvert/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Repair the culvert" })).toBeInTheDocument();
    const card = await screen.findByRole("region", { name: "Work order" });
    expect(card.querySelector(".sec-foot")?.textContent).toMatch(/Edit/);
    expect(card.querySelector(".sec-foot")?.textContent).toMatch(/Change state/);
    expect(await screen.findByRole("region", { name: "Assignee" })).toBeInTheDocument();
  });
});

describe("a work order's About and Assignee are cards of their own", () => {
  it("has an About card whose row names the asset and its place and opens the asset page", async () => {
    show("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Repair the culvert/ }));
    const about = await screen.findByRole("region", { name: "About" });
    expect(about.querySelector(".lead")).not.toBeNull();
    expect(about.textContent).toContain("Riverside Yard");
    expect(screen.getByRole("region", { name: "Work order" }).textContent).not.toContain("Road roller");
    await userEvent.click(within(about).getByRole("button", { name: /Road roller/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Road roller" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Asset detail" })).toBeInTheDocument();
  });

  it("says Not assigned yet in the Assignee card and puts Assign in its footer for a seat that may assign", async () => {
    permissions = ["task.edit", "task.assign"];
    show("Work Orders");
    await userEvent.click(await screen.findByRole("button", { name: /Repair the culvert/ }));
    const card = await screen.findByRole("region", { name: "Assignee" });
    expect(card.textContent).toContain("Not assigned yet.");
    expect(card.querySelector(".sec-foot")?.textContent).toContain("Assign");
  });
});

describe("the maintenance schedule card", () => {
  it("has a Schedule card with Edit in its footer", async () => {
    show("Maintenance Schedule");
    await userEvent.click(await screen.findByRole("button", { name: /Grease the pumps/ }));
    const card = await screen.findByRole("region", { name: "Schedule" });
    expect(card.textContent).toContain("Weekly");
    expect(card.querySelector(".sec-foot button")?.textContent).toBe("Edit");
    expect(document.querySelector(".wf-head")).toBeNull();
  });
});

describe("an asset opened on a phone has no title band above its name", () => {
  it("shows the category title on the list and not above the opened asset", async () => {
    setWide(false);
    show("Equipment");
    expect(await screen.findByRole("heading", { level: 1, name: "Equipment" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
    await screen.findByRole("heading", { level: 1, name: "Road roller" });
    expect(screen.queryByRole("heading", { level: 1, name: "Equipment" })).toBeNull();
    expect(document.querySelector(".head")).toBeNull();
  });
});
