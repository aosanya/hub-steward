import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AgencyModule, AgencyView } from "../../../../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import { SectionPage } from "../../SectionPage";

const town = (modules: AgencyModule[]): AgencyView => ({ name: "Zöldhalom", modules });

const withWords = town([{ code: "actor", name: "Residents", mountNames: ["Residents"], words: { People: "Residents", Person: "Resident" } }]);

const withoutWords = town([{ code: "actor", name: "actor", mountNames: ["actor"] }]);

const showResidentsMenu = (agency: AgencyView) =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/residents"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage agency={{ read: async () => agency }} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

describe("the Residents submenu rows", () => {
  it("reads All Residents on the first row when the agency words People as Residents", async () => {
    showResidentsMenu(withWords);

    expect(await screen.findByText("All Residents")).toBeInTheDocument();
    expect(screen.queryByText("All People")).toBeNull();
  });

  it("reads All People on the first row when the agency lists no words", async () => {
    showResidentsMenu(withoutWords);

    expect(await screen.findByText("All People")).toBeInTheDocument();
  });
});
