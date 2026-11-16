import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AgencyView } from "../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../features/agency/open";
import { MenuRows } from "./MenuRows";
import { SectionPage } from "./SectionPage";

const school = (mountNames: Record<string, string[]>): AgencyView => ({
  name: "School",
  modules: Object.entries(mountNames).map(([code, names]) => ({ code, name: names[0] ?? code, mountNames: names })),
});

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const home = (agency: AgencyView) =>
  render(
    <MemoryRouter initialEntries={["/a/town/home"]}>
      <MenuRows agency={{ read: async () => agency }} />
    </MemoryRouter>,
  );

const section = (id: string, agency: AgencyView) =>
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/${id}`]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage agency={{ read: async () => agency }} />} />
      </Routes>
    </MemoryRouter>,
  );

const rowTitles = () => screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);

describe("a section named by its mount", () => {
  it("shows the mount's name on Home where the town council words were", async () => {
    home(school({ actor: ["Students"], forms: ["Requests"] }));

    await screen.findByText("Students");
    expect(rowTitles()).toEqual(["Students", "Requests", "Services & Permits", "Staff & Departments", "Settings"]);
  });

  it("gives the second section of a module the module's second mount name", async () => {
    home(school({ actor: ["Students", "Teachers"] }));

    await screen.findByText("Students");
    expect(rowTitles()).toEqual(["Students", "Teachers", "Settings"]);
  });

  it("keeps the old words for a mount with no name", async () => {
    home(school({ actor: [], forms: [] }));

    await screen.findByText("Residents");
    expect(rowTitles()).toEqual(["Residents", "Issues & Requests", "Services & Permits", "Staff & Departments", "Settings"]);
  });

  it("titles the section screen with the mount's name and keeps its submenus", async () => {
    section("residents", school({ actor: ["Students"] }));

    expect(await screen.findByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.getByText("All Residents")).toBeInTheDocument();
  });

  it("titles the section screen with the old words when the mount has no name", async () => {
    section("residents", school({ actor: [] }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Residents" })).toBeInTheDocument());
  });

  it("keeps the fixed words on Home when each mount is named after its module code", async () => {
    home(school({ actor: ["actor"], forms: ["forms"], voting: ["voting"], accounting: ["accounting"] }));

    await screen.findByText("Residents");
    expect(rowTitles()).toEqual([
      "Residents",
      "Issues & Requests",
      "Services & Permits",
      "Council & Decisions",
      "Staff & Departments",
      "Finance",
      "Settings",
    ]);
  });

  it("titles the section screen with the old words when the mount is named after its module code", async () => {
    section("residents", school({ actor: ["actor"] }));
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "Residents" })).toBeInTheDocument();
  });

  it("shows Assets & Works on Home for an agency that holds the assetmanager module", async () => {
    home(school({ assetmanager: ["assetmanager"] }));

    await screen.findByText("Assets & Works");
    expect(rowTitles()).toEqual(["Assets & Works", "Settings"]);
  });

  it("titles Assets & Works with the name the agency gave its assetmanager mount", async () => {
    home(school({ assetmanager: ["Roads and Works"] }));

    await screen.findByText("Roads and Works");
    expect(rowTitles()).toEqual(["Roads and Works", "Settings"]);
  });

  it("titles the Assets & Works screen with the mount's name and keeps its submenus", async () => {
    section("assets", school({ assetmanager: ["Roads and Works"] }));

    expect(await screen.findByRole("heading", { name: "Roads and Works" })).toBeInTheDocument();
    expect(screen.getByText("Work Orders")).toBeInTheDocument();
  });

  it("hides Assets & Works from an agency without the assetmanager module", async () => {
    home(school({ actor: ["actor"] }));

    await screen.findByText("Residents");
    expect(rowTitles()).not.toContain("Assets & Works");
  });

  it("still titles a real name when another mount is named after its module code", async () => {
    home(school({ actor: ["Students"], forms: ["forms"] }));

    await screen.findByText("Students");
    expect(rowTitles()).toEqual(["Students", "Issues & Requests", "Services & Permits", "Staff & Departments", "Settings"]);
  });
});
