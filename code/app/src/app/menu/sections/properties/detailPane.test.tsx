import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AddressesPage } from "./AddressesPage";
import { LandUsePage } from "./LandUsePage";
import { OwnershipPage } from "./OwnershipPage";
import { PlacesPage } from "./PlacesPage";

const mounted = { modules: [{ module: "digitaltwin" }, { module: "assetmanager" }] };

const screens = [
  {
    title: "Addresses",
    Page: AddressesPage,
    listTool: "digitaltwin_address_list",
    list: [{ id: "d1", street: "Kossuth utca", number: "7", area: "Old Quarter", postcode: "6724" }],
    row: /Kossuth utca 7/,
    readTool: "digitaltwin_address_read",
    readArgs: { addressID: "d1" },
    read: { id: "d1", street: "Kossuth utca", number: "7", area: "Zoldhalom Centre", postcode: "6724" },
    shown: /Zoldhalom Centre/,
  },
  {
    title: "Places",
    Page: PlacesPage,
    listTool: "assetmanager_asset_list",
    list: [{ id: "n1", name: "Zoldhalom Library", category: "Building" }],
    row: /Zoldhalom Library/,
    readTool: "assetmanager_asset_read",
    readArgs: { assetID: "n1" },
    read: { id: "n1", name: "Zoldhalom Library", category: "Reading room and archive" },
    shown: /Reading room and archive/,
  },
  {
    title: "Land Use",
    Page: LandUsePage,
    listTool: "digitaltwin_land_use_list",
    list: [{ id: "u1", zone: "Residential", use: "Housing", area: "Old Quarter" }],
    row: /Residential/,
    readTool: "digitaltwin_land_use_read",
    readArgs: { landUseID: "u1" },
    read: { id: "u1", zone: "Residential", use: "Weekly market stalls", area: "Old Quarter" },
    shown: /Weekly market stalls/,
  },
  {
    title: "Ownership & Tenure",
    Page: OwnershipPage,
    listTool: "digitaltwin_tenure_list",
    list: [{ id: "t1", place_id: "n1", holder: "Bela Szabo", kind: "owner", since: "2019-03-01T00:00:00Z" }],
    row: /Bela Szabo/,
    readTool: "digitaltwin_tenure_read",
    readArgs: { tenureID: "t1" },
    read: { id: "t1", place_id: "n1", holder: "Bela Szabo", kind: "life tenant", since: "2019-03-01T00:00:00Z" },
    shown: /life tenant/,
  },
];

let called: MockInstance<typeof mcp.callTool>;

beforeEach(() => {
  openAgency("zoldhalom");
  setWide(true);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(screens)("$title on a wide screen", ({ Page, listTool, list, row, readTool, readArgs, read, shown }) => {
  it("opens the chosen row in the right pane with what its read tool replies", async () => {
    called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "agency_list_mounts") return mounted;
      if (name === listTool) return { items: list };
      if (name === readTool) return { item: read };
      return { items: [] };
    });
    render(
      <MemoryRouter initialEntries={["/a/zoldhalom/menu/properties/page"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/properties/page" element={<Page />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByText(row, { selector: ".ttl" }));

    const content = document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
    expect(content).not.toBeNull();
    expect(await within(content).findByText(shown)).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", readTool, readArgs);
  });
});

const phoneScreens = screens.filter((screen) => screen.title !== "Places");

describe.each(phoneScreens)("$title on a phone", ({ Page, listTool, list, row, readTool, readArgs, read, shown }) => {
  it("opens the chosen row as a page with what its read tool replies", async () => {
    setWide(false);
    called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "agency_list_mounts") return mounted;
      if (name === listTool) return { items: list };
      if (name === readTool) return { item: read };
      return { items: [] };
    });
    render(
      <MemoryRouter initialEntries={["/a/zoldhalom/menu/properties/page"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/properties/page" element={<Page />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByText(row, { selector: ".ttl" }));

    const page = document.querySelector(".mw-detail") as HTMLElement;
    expect(page).not.toBeNull();
    expect(await within(page).findByText(shown)).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", readTool, readArgs);
  });
});
