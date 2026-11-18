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
import { assetPaths } from "./paths";
import { routes } from "./index";
import { answerActors } from "./keeperActors";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const assets = [{ id: "e1", code: "A-12", name: "Road roller", category: "Equipment", location_id: "l2" }];
const locations = [{ id: "l2", name: "Riverside Yard" }];
const tasks = [{ id: "t1", title: "Repair the culvert", state: "To do", status: "pending", due_at: "2026-11-24T00:00:00Z", linked_ref: "e1" }];

const byId = (rows: { id: string }[], args: unknown, key: string) => rows.find((row) => row.id === (args as Record<string, string>)[key]);

const answer = (name: string, args: unknown): Promise<unknown> => {
  const actors = answerActors(name, args);
  if (actors) return actors;
  if (name === "agency_get_my_roles") return Promise.resolve({ permissions: ["asset.manage", "task.edit"] });
  if (name === "agency_list_mounts") return Promise.resolve({ modules: [{ module: "assetmanager" }, { module: "taskmanager" }] });
  if (name === "assetmanager_asset_list") return Promise.resolve({ items: assets });
  if (name === "assetmanager_asset_read") return Promise.resolve({ item: byId(assets, args, "assetID") });
  if (name === "assetmanager_location_list") return Promise.resolve({ items: locations });
  if (name === "assetmanager_location_read") return Promise.resolve({ item: byId(locations, args, "locationID") });
  if (name === "assetmanager_movement_list") return Promise.resolve({ items: [] });
  if (name === "taskmanager_task_list") return Promise.resolve({ items: tasks });
  if (name === "taskmanager_task_read") return Promise.resolve({ item: byId(tasks, args, "taskID") });
  if (name === "taskmanager_agent_list") return Promise.resolve({ items: [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  setWide(true);
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
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

describe("Chat in the bar on an asset's page", () => {
  it("opens the assistant about the chosen asset", async () => {
    open(assetPaths.equipment.path({ item: "e1" }));
    await screen.findByRole("heading", { level: 1, name: "Road roller" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Road roller");
    expect(screen.getByRole("textbox", { name: "Ask about Road roller" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "asset", id: "e1", name: "Road roller" });
    expect(carriedChatFrom()).toBe(assetPaths.equipment.path({ item: "e1" }));
  });

  it("carries nothing while no asset is chosen, so the Chat tab opens the plain assistant", async () => {
    open(assetPaths.equipment.path());
    await screen.findByRole("button", { name: /Road roller/ });
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on a work order's page", () => {
  it("opens the assistant about the chosen work order", async () => {
    open(assetPaths.workOrders.path({ item: "t1" }));
    await screen.findByRole("heading", { level: 1, name: "Repair the culvert" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Repair the culvert");
    expect(screen.getByRole("textbox", { name: "Ask about Repair the culvert" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "workorder", id: "t1", name: "Repair the culvert" });
    expect(carriedChatFrom()).toBe(assetPaths.workOrders.path({ item: "t1" }));
  });
});
