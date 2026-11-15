import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
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
});
