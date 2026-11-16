import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AgencyModule, AgencyView } from "../../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { MenuRows } from "./MenuRows";
import { SectionPage } from "./SectionPage";

const town = (modules: AgencyModule[]): AgencyView => ({ name: "Zöldhalom", modules });

const withWords = town([
  { code: "actor", name: "actor", mountNames: ["actor"], words: { People: "Residents", "Boundaries & Areas": "Boundaries & Wards" } },
  { code: "digitaltwin", name: "digitaltwin", mountNames: ["digitaltwin"], words: { "Places & Addresses": "Properties & Addresses", Places: "Properties" } },
  { code: "council", name: "council", mountNames: ["council"], words: { Decisions: "Council & Decisions", Rules: "Bylaws" } },
  { code: "assetmanager", name: "assetmanager", mountNames: ["assetmanager"], words: { Routes: "Roads & Paths", Equipment: "Water Points", Facilities: "Street Lights" } },
  { code: "agency", name: "agency", mountNames: ["agency"], words: { "Agency Profile": "Municipality Profile" } },
]);

const withoutWords = town(["actor", "digitaltwin", "council", "assetmanager"].map((code) => ({ code, name: code, mountNames: [code] })));

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
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const rowTitles = () => screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);

describe("the menu in the agency's words", () => {
  it("draws the section rows on Home with the agency's words", async () => {
    home(withWords);

    await screen.findByText("Residents");
    expect(rowTitles()).toEqual(["Residents", "Properties & Addresses", "Assets & Works", "Council & Decisions", "Staff & Departments", "Settings"]);
  });

  it("draws the generic section rows on Home for an agency without words", async () => {
    home(withoutWords);

    await screen.findByText("People");
    expect(rowTitles()).toEqual(["People", "Places & Addresses", "Assets & Works", "Decisions", "Staff & Departments", "Settings"]);
  });

  it("titles a section screen and its submenu rows with the agency's words", async () => {
    section("properties", withWords);

    expect(await screen.findByRole("heading", { name: "Properties & Addresses" })).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.queryByText("Places")).toBeNull();
    expect(screen.getByText("Addresses")).toBeInTheDocument();
  });

  it("words the asset rows as the agency does and keeps the rows it has no word for", async () => {
    section("assets", withWords);

    await screen.findByText("Roads & Paths");
    ["Water Points", "Street Lights", "Buildings", "Work Orders"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
    ["Routes", "Equipment", "Facilities"].forEach((title) => expect(screen.queryByText(title)).toBeNull());
  });

  it("words the council rows and the Settings rows", async () => {
    section("council", withWords);
    await screen.findByText("Bylaws");
    expect(screen.queryByText("Rules")).toBeNull();
    cleanup();

    section("settings", withWords);
    await screen.findByText("Municipality Profile");
    expect(screen.getByText("Boundaries & Wards")).toBeInTheDocument();
    expect(screen.getByText("Users & Roles")).toBeInTheDocument();
    expect(screen.queryByText("Agency Profile")).toBeNull();
  });

  it("shows the generic rows for an agency without words", async () => {
    section("assets", withoutWords);

    await screen.findByText("Routes");
    ["Equipment", "Facilities", "Buildings"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
  });

  it("opens a reworded row on the same route as the generic one", async () => {
    section("assets", withWords);

    await userEvent.click(await screen.findByRole("button", { name: /Roads & Paths/ }));
    const reworded = landed;
    cleanup();
    section("assets", withoutWords);
    await userEvent.click(await screen.findByRole("button", { name: /Routes/ }));

    expect(reworded).not.toBe("/a/town/menu/assets");
    expect(reworded).toBe(landed);
  });

  it("lets a mount's own name win over a word for the section title", async () => {
    home(town([{ code: "actor", name: "Students", mountNames: ["Students"], words: { People: "Residents" } }]));

    await screen.findByText("Students");
    expect(rowTitles()).toEqual(["Students", "Staff & Departments", "Settings"]);
  });
});
