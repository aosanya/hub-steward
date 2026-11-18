import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ReportsScreen } from "./ReportsScreen";

const loaded = vi.hoisted(() => ({ pdfLib: 0, fontkit: 0 }));

vi.mock("pdf-lib", async (original) => {
  loaded.pdfLib += 1;
  return original();
});

vi.mock("@pdf-lib/fontkit", async (original) => {
  loaded.fontkit += 1;
  return original();
});

const reports = [{ name: "Second quarter", period_start: "2026-04-01", period_end: "2026-07-01" }];
const figures = { planned: 8000, spent: 8300, difference: -300, departments: [], balances: [] };

beforeEach(() => {
  openAgency("town");
  URL.createObjectURL = vi.fn(() => "blob:report");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "accounting_report_list") return { items: reports };
    if (name === "accounting_report_read") return { ...reports[0], figures, lines: [] };
    if (name === "agency_get_my_roles") return { permissions: [] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the PDF library is loaded only when Create PDF is pressed", () => {
  it("opens the report and the Actions list without loading pdf-lib or the font tool, then loads them on Create PDF", async () => {
    render(
      <MemoryRouter initialEntries={["/a/town/menu/finance/reports"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/finance/reports" element={<ReportsScreen />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Second quarter/ }, { timeout: 10000 }));
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }, { timeout: 10000 }));
    expect(loaded).toEqual({ pdfLib: 0, fontkit: 0 });

    await userEvent.click(screen.getByRole("button", { name: "Create PDF" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1), { timeout: 20000 });
    expect(loaded.pdfLib).toBe(1);
    expect(loaded.fontkit).toBe(1);
  }, 30000);
});
