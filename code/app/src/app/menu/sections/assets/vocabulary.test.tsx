import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { assetPaths } from "./paths";

const ownWords = { Routes: "Roads & Paths", Equipment: "Water Points", Facilities: "Street Lights", Buildings: "Premises", "Work Orders": "Jobs" };

const answerWith = (words: Record<string, string>) => async (_agency: string, name: string) => {
  if (name === "agency_get_agency") return { name: "Zoldhalom" };
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager", mounts: [{ name: "Assets", words }] }] };
  return { items: [] };
};

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the asset screens read the agency's words", () => {
  it.each([
    ["routes", "Roads & Paths", "No roads & paths yet."],
    ["equipment", "Water Points", "No water points yet."],
    ["facilities", "Street Lights", "No street lights yet."],
    ["buildings", "Premises", "No premises yet."],
    ["workOrders", "Jobs", "No jobs yet."],
  ])("%s shows the title and the empty state in the agency's words", async (key, title, empty) => {
    vi.spyOn(mcp, "callTool").mockImplementation(answerWith(ownWords) as typeof mcp.callTool);
    show(assetPaths[key as keyof typeof assetPaths].path());
    expect(await screen.findByText(empty)).toBeTruthy();
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });

  it.each([
    ["routes", "Routes", "No routes yet."],
    ["equipment", "Equipment", "No equipment yet."],
    ["workOrders", "Work Orders", "No work orders yet."],
  ])("%s shows the generic text when the agency lists no words", async (key, title, empty) => {
    vi.spyOn(mcp, "callTool").mockImplementation(answerWith({}) as typeof mcp.callTool);
    show(assetPaths[key as keyof typeof assetPaths].path());
    expect(await screen.findByText(empty)).toBeTruthy();
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });
});
