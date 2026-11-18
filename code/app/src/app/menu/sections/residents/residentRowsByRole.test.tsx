import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { SectionPage } from "../../SectionPage";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const rowsThatOpenPeople = ["Search", "All People", "Registrations"];

const rowsThatDoNot = ["Households", "Groups & Associations", "Communications", "Businesses", "Informal traders"];

const showResidentsMenu = (permissions: string[]) => {
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => (tool === "agency_get_my_roles" ? { permissions } : { items: [] }));
  render(
    <MemoryRouter initialEntries={["/a/town/menu/residents"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage agency={{ read: async () => ({ name: "Zöldhalom", modules: [] }) }} />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Residents rows that open a person", () => {
  it("shows Search, All People and Registrations to a holder of resident.read", async () => {
    showResidentsMenu(["resident.read"]);

    for (const title of rowsThatOpenPeople) expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("hides them from a person who holds the older permissions but not resident.read", async () => {
    showResidentsMenu(["member.read", "member.view", "accounting.view"]);

    expect(await screen.findByText("Households")).toBeInTheDocument();
    await waitFor(() => rowsThatOpenPeople.forEach((title) => expect(screen.queryByText(title)).toBeNull()));
  });

  it("keeps the rows that do not open a person for a person without the role", async () => {
    showResidentsMenu([]);

    for (const title of rowsThatDoNot) expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
