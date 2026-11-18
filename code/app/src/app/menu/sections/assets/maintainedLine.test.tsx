import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { answerActors } from "./keeperActors";

const asset = { id: "e1", code: "A-12", name: "Road roller", category: "Equipment", condition: "Good", location_id: "l2" };

let maintenance: { id: string; answers: Record<string, string> }[];

const rowOf = (id: string, done: string) => ({ id, answers: { Asset: "Road roller A-12", "Date done": done, Kind: "Routine", "What was done": `Job ${id}` } });

const answer = (name: string, args: unknown): Promise<unknown> => {
  const actors = answerActors(name, args);
  if (actors) return actors;
  if (name === "agency_get_my_roles") return Promise.resolve({ permissions: ["asset.manage"] });
  if (name === "agency_list_mounts") return Promise.resolve({ modules: [{ module: "assetmanager" }, { module: "taskmanager" }] });
  if (name === "agency_list_live_records") return Promise.resolve({ items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }] });
  if (name === "agency_list_live_record_rows") return Promise.resolve({ items: maintenance });
  if (name === "assetmanager_asset_list") return Promise.resolve({ items: [asset] });
  if (name === "assetmanager_asset_read") return Promise.resolve({ item: asset });
  if (name === "assetmanager_location_list") return Promise.resolve({ items: [{ id: "l2", name: "Riverside Yard" }] });
  if (name === "assetmanager_location_read") return Promise.resolve({ item: { id: "l2", name: "Riverside Yard" } });
  if (name === "assetmanager_movement_list" || name === "taskmanager_task_list") return Promise.resolve({ items: [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetWidth();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const quietLineOfAsset = async () => {
  render(
    <MemoryRouter initialEntries={[items.find((item) => item.title === "Equipment")?.path?.() ?? ""]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
  const title = await screen.findByRole("heading", { level: 1, name: "Road roller" });
  return title.closest(".person-page")?.querySelector(".quiet-line") ?? null;
};

describe("the quiet line under an asset's name", () => {
  it("adds when it was last maintained, from the newest record", async () => {
    maintenance = [rowOf("a", "2026-03-01"), rowOf("b", "2026-11-12"), rowOf("c", "2026-06-20")];

    const line = await quietLineOfAsset();

    await vi.waitFor(() => expect(line?.textContent).toContain("Last maintained Thursday, 12 Nov"));
    expect(line?.textContent).toContain("Equipment");
  });

  it("says nothing about maintenance when there is no record", async () => {
    maintenance = [];

    const line = await quietLineOfAsset();

    expect(line?.textContent).toContain("Equipment");
    expect(line?.textContent).not.toContain("Last maintained");
  });

  it("skips a record with no date", async () => {
    maintenance = [rowOf("a", ""), rowOf("b", "2026-06-20")];

    const line = await quietLineOfAsset();

    await vi.waitFor(() => expect(line?.textContent).toContain("Last maintained Saturday, 20 Jun"));
  });
});
