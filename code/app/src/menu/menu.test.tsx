import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { MenuRows } from "./MenuRows";
import { SectionPage, notYetWords } from "./SectionPage";
import { menuSections } from "./sections";

const view = (codes: string[], over: Partial<AgencyView> = {}): AgencyView => ({ name: "Zöldhalom", modules: codes.map((code) => ({ code, name: code })), ...over });

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const home = (agency: AgencyView | Error) =>
  render(
    <MemoryRouter initialEntries={["/a/town/home"]}>
      <MenuRows agency={{ read: async () => (agency instanceof Error ? Promise.reject(agency) : agency) }} />
      <Where />
    </MemoryRouter>,
  );

const section = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/${id}`]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the menu rows on Home", () => {
  it("draws nothing for an agency with none of the sections' modules, Settings included", async () => {
    home(view(["taskmanager"]));

    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("lists only the sections whose module the agency has switched on, with Settings after them", async () => {
    home(view(["actor", "forms"]));

    await screen.findByText("Residents");
    expect(screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent)).toEqual([
      "Residents",
      "Issues & Requests",
      "Services & Permits",
      "Staff & Departments",
      "Settings",
    ]);
  });

  it("opens the section's own screen", async () => {
    home(view(["actor"]));

    await userEvent.click(await screen.findByRole("button", { name: /Residents/ }));

    expect(landed).toBe("/a/town/menu/residents");
  });

  it("draws nothing while the modules cannot be read", async () => {
    home(view(["actor"], { modulesUnread: true }));

    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("draws nothing when the agency read fails", async () => {
    home(new Error("no"));

    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("names each section once and gives it a different id", () => {
    expect(new Set(menuSections.map((one) => one.id)).size).toBe(menuSections.length);
    expect(new Set(menuSections.map((one) => one.title)).size).toBe(menuSections.length);
  });
});

describe("a menu section's screen", () => {
  it("lists the section's submenus under its name", () => {
    section("issues");

    expect(screen.getByRole("heading", { name: "Issues & Requests" })).toBeInTheDocument();
    ["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
  });

  it("opens a submenu that has a screen", async () => {
    section("issues");

    await userEvent.click(screen.getByRole("button", { name: /Overdue/ }));

    expect(landed).toBe("/a/town/council/late-matters");
  });

  it("opens Applications on the forms list", async () => {
    section("services");

    await userEvent.click(screen.getByRole("button", { name: /Applications/ }));

    expect(landed).toBe("/a/town/forms");
  });

  it("marks a submenu with no screen as not available yet and gives it no button", () => {
    section("residents");

    expect(screen.queryByRole("button", { name: /All Residents/ })).toBeNull();
    expect(screen.getAllByText(notYetWords)).toHaveLength(5);
  });

  it("goes back to Home for a section it does not know", () => {
    section("unknown");

    expect(landed).toBe("/a/town/home");
  });
});
