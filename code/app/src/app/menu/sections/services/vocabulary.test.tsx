import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ApplicationScreen } from "./ApplicationScreen";
import { ApplicationsScreen } from "./ApplicationsScreen";
import { FeesPaymentsScreen, PermitsScreen, ServiceCatalogueScreen } from "./ServicesScreens";

const agencyWords = {
  Permits: "Engedelyek",
  "Fees & Payments": "Dijak es befizetesek",
  Fees: "Dijak",
  "Service Catalogue": "Szolgaltatasi katalogus",
  Services: "Szolgaltatasok",
  Applications: "Kerelmek",
  Application: "Kerelem",
};

const answerWith = (words: Record<string, string>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_agency") return { name: "Zoldhalom" };
    if (name === "agency_list_mounts") return { modules: [{ module: "forms", mounts: [{ name: "Forms", words }] }] };
    if (name === "forms_submission_read_mine") return { form_id: "f1", sent_at: "2026-03-04T12:00:00Z" };
    return { items: [] };
  });

const at = (path: string, pattern: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Services screens read the agency's words", () => {
  it("names the permits screen and its empty state in the agency's words", async () => {
    answerWith(agencyWords);
    at("/a/town/menu/services/permits", "/a/:agencyId/menu/services/permits", <PermitsScreen />);

    expect(await screen.findByText("No engedelyek yet.")).toBeTruthy();
    expect(screen.getAllByText("Engedelyek").length).toBeGreaterThan(0);
  });

  it("names the fees screen, its empty state and the service catalogue in the agency's words", async () => {
    answerWith(agencyWords);
    at("/a/town/menu/services/fees", "/a/:agencyId/menu/services/fees", <FeesPaymentsScreen />);
    expect(await screen.findByText("No dijak yet.")).toBeTruthy();
    expect(screen.getAllByText("Dijak es befizetesek").length).toBeGreaterThan(0);
    cleanup();

    at("/a/town/menu/services/catalogue", "/a/:agencyId/menu/services/catalogue", <ServiceCatalogueScreen />);
    expect(await screen.findByText("No szolgaltatasok yet.")).toBeTruthy();
    expect(screen.getAllByText("Szolgaltatasi katalogus").length).toBeGreaterThan(0);
  });

  it("names the applications list and its empty state in the agency's words", async () => {
    answerWith(agencyWords);
    at("/a/town/menu/services/applications", "/a/:agencyId/menu/services/applications", <ApplicationsScreen />);

    expect(await screen.findByText("You have not sent a kerelem yet.")).toBeTruthy();
    expect(screen.getAllByText("Kerelmek").length).toBeGreaterThan(0);
  });

  it("names the application page and its withdraw button keeps its wording", async () => {
    answerWith(agencyWords);
    at("/a/town/menu/services/applications/f1", "/a/:agencyId/menu/services/applications/:id", <ApplicationScreen />);

    await waitFor(() => expect(screen.getAllByText("Kerelem").length).toBeGreaterThan(0));
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeTruthy();
  });

  it("shows the generic words when the agency lists none", async () => {
    answerWith({});
    at("/a/town/menu/services/permits", "/a/:agencyId/menu/services/permits", <PermitsScreen />);
    expect(await screen.findByText("No permits yet.")).toBeTruthy();
    expect(screen.getAllByText("Permits").length).toBeGreaterThan(0);
    cleanup();

    at("/a/town/menu/services/applications", "/a/:agencyId/menu/services/applications", <ApplicationsScreen />);
    expect(await screen.findByText("You have not sent an application yet.")).toBeTruthy();
    expect(screen.getAllByText("Applications").length).toBeGreaterThan(0);
  });
});
