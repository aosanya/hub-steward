import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllIssuesScreen, MapViewScreen, ServiceTypesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const words = { Issues: "Reports", "Service Types": "Request Kinds" };

const answerWith = (listed: Record<string, string>) => {
  const answers: Record<string, (args: Args) => unknown> = {
    agency_get_agency: () => ({ name: "Zoldhalom" }),
    agency_list_mounts: () => ({ modules: [{ module: "forms", mounts: [{ name: "Reports", words: listed }] }] }),
    forms_catalog_raised_item_list_nearby: () => ({ items: [] }),
    forms_catalog_raised_item_list_mine: () => ({ items: [] }),
    forms_catalog_setting_read: () => ({ value: "" }),
    forms_catalog_entry_list: () => ({ items: [] }),
  };
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
};

const open = (at: string, Screen: () => JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/*" element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Issues & Requests screens read the agency's words", () => {
  it("shows the agency's words in the title and empty state of the list", async () => {
    answerWith(words);
    open("/a/town/menu/issues/all", AllIssuesScreen);
    expect(await screen.findByText("No reports yet.")).toBeInTheDocument();
    expect(screen.getAllByText("All Reports").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
  });

  it("shows the agency's words on the service types and map screens", async () => {
    answerWith(words);
    open("/a/town/menu/issues/service-types", ServiceTypesScreen);
    expect(await screen.findByText("No request kinds yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Request Kinds").length).toBeGreaterThan(0);
    cleanup();
    open("/a/town/menu/issues/map", MapViewScreen);
    expect(await screen.findByText("No reports on the map yet.")).toBeInTheDocument();
  });

  it("shows the generic text when the agency lists no words", async () => {
    answerWith({});
    open("/a/town/menu/issues/all", AllIssuesScreen);
    expect(await screen.findByText("No issues yet.")).toBeInTheDocument();
    expect(screen.getAllByText("All Issues").length).toBeGreaterThan(0);
    cleanup();
    open("/a/town/menu/issues/service-types", ServiceTypesScreen);
    expect(await screen.findByText("No service types yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Service Types").length).toBeGreaterThan(0);
  });
});
