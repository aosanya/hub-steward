import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { MenuRows } from "./MenuRows";
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

  it("lists the nine sections in the drawn order for an agency with every module, and no Dashboard row", async () => {
    home(view(["actor", "digitaltwin", "forms", "assetmanager", "voting", "accounting"]));

    await screen.findByText("Residents");
    const titles = screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);
    expect(titles).toEqual([
      "Residents",
      "Properties & Addresses",
      "Issues & Requests",
      "Services & Permits",
      "Assets & Works",
      "Council & Decisions",
      "Staff & Departments",
      "Finance",
      "Settings",
    ]);
    expect(titles).not.toContain("Dashboard");
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
