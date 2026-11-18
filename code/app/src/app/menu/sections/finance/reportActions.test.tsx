import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ReportsScreen } from "./ReportsScreen";

const reports = [{ name: "Second quarter", period_start: "2026-04-01", period_end: "2026-07-01" }];

const figures = {
  planned: 8000,
  spent: 8300,
  difference: -300,
  departments: [{ department: "Transport", planned: 8000, spent: 8300, difference: -300 }],
  balances: [],
};

const lines = [{ id: "line-id-9", name: "Road repair", department: "Transport", planned: 8000, spent: 8300 }];

let permissions: string[];
let blobs: Blob[];
let downloads: string[];

const textOf = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsBinaryString(blob);
  });

const openSecondQuarter = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/reports"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/reports" element={<ReportsScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Second quarter/ }));
  await waitFor(() => expect(document.querySelector(".mw-detail")?.textContent).toContain("8,300"));
};

beforeEach(() => {
  openAgency("town");
  permissions = ["notification.raise"];
  blobs = [];
  downloads = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:report";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "accounting_report_list") return { items: reports };
    if (name === "accounting_report_read") return { ...reports[0], figures, lines, period: (args as Record<string, unknown> | undefined)?.period_start };
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "actor_list_actors") return { items: [] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Actions dropdown on an opened financial report", () => {
  it("sits at the top left, above the page title, closed until pressed", async () => {
    await openSecondQuarter();
    const button = await screen.findByRole("button", { name: "Actions" });
    const title = screen.getByRole("heading", { level: 1, name: "Second quarter" });

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create PDF" })).toBeNull();
  });

  it("lists Share and Create PDF when pressed, and draws no Send to a person bar", async () => {
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));

    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create PDF" })).toBeInTheDocument();
    expect(screen.queryByText("Send to a person")).toBeNull();
  });

  it("opens the sheet titled Share from the Share item", async () => {
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("heading", { name: "Share" })).toBeInTheDocument();
  });

  it("offers Create PDF without Share to a caller who may not raise a notification", async () => {
    permissions = [];
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));

    expect(screen.getByRole("button", { name: "Create PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("downloads a PDF named after the report, carrying its words and no id", async () => {
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("button", { name: "Create PDF" }));

    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(downloads).toEqual(["Second quarter.pdf"]);
    expect(blobs[0].type).toBe("application/pdf");
    const body = await textOf(blobs[0]);
    expect(body.startsWith("%PDF")).toBe(true);
    expect(body).toContain("Second quarter");
    expect(body).toContain("Road repair");
    expect(body).toContain("8,300");
    expect(body).not.toContain("line-id-9");
    expect(body).not.toContain("2026-04-01~2026-07-01");
  });
});
