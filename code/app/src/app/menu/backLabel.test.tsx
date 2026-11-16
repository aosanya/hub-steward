import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AgencyView } from "../../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { SectionPage } from "./SectionPage";
import { routes as propertyRoutes } from "./sections/properties";

const sectionWords = { "Places & Addresses": "Properties & Addresses" };

const agencyView: AgencyView = { name: "Zoldhalom", modules: [{ code: "digitaltwin", name: "digitaltwin", mountNames: ["digitaltwin"], words: sectionWords }] };

const answer = async (_agency: string, name: string) => {
  if (name === "agency_get_agency") return { name: "Zoldhalom" };
  if (name === "agency_list_mounts") return { modules: [{ module: "digitaltwin", mounts: [{ name: "digitaltwin", words: sectionWords }] }] };
  if (name.startsWith("digitaltwin_")) return { items: [] };
  throw new Error(`${name}: unknown tool`);
};

const screens = ["Addresses", "Ownership & Tenure", "Land Use"];

const coldLoad = (agency: { read: () => Promise<AgencyView> }) =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/properties"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage agency={agency} />} />
        {propertyRoutes()}
      </Routes>
    </MemoryRouter>,
  );

const slowAgency = () => {
  let release: (view: AgencyView) => void = () => undefined;
  const read = () => new Promise<AgencyView>((resolve) => (release = resolve));
  return { agency: { read }, release: (view: AgencyView) => release(view) };
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the back label of a screen opened from the properties section", () => {
  it.each(screens)("reads the section's own name on %s when it is opened before the words arrived", async (screenName) => {
    const slow = slowAgency();
    coldLoad(slow.agency);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(screenName) }));

    expect(await screen.findByRole("button", { name: /Properties & Addresses/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Places & Addresses/ })).toBeNull();
  });

  it.each(screens)("reads the section's own name on %s when it is opened after the words arrived", async (screenName) => {
    coldLoad({ read: async () => agencyView });
    await screen.findByRole("heading", { name: "Properties & Addresses" });

    await userEvent.click(screen.getByRole("button", { name: new RegExp(screenName) }));

    expect(await screen.findByRole("button", { name: /Properties & Addresses/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Places & Addresses/ })).toBeNull();
  });
});
