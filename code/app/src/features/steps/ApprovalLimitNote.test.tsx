import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { ApprovalLimitNote } from "./ApprovalLimitNote";

const agencyNaming = (words: Record<string, string>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => (name === "agency_list_mounts" ? { modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words }] }] } : {}));

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the approval limit note", () => {
  it("shows the amount in the currency the agency names", async () => {
    agencyNaming({ Currency: "Ft" });
    render(<ApprovalLimitNote limit={{ amount: 500000 }} />);
    expect(await screen.findByText("Your approval limit: 500 000 Ft")).toBeTruthy();
  });

  it("shows the amount with no unit when the agency names no currency", async () => {
    const asked = agencyNaming({});
    render(<ApprovalLimitNote limit={{ amount: 500000 }} />);
    expect(await screen.findByText("Your approval limit: 500 000")).toBeTruthy();
    expect(asked).toHaveBeenCalled();
    expect(screen.queryByText(/\bFt\b/)).toBeNull();
  });

  it("says no upper limit is written when the amount is missing", () => {
    agencyNaming({});
    render(<ApprovalLimitNote limit={{}} />);
    expect(screen.getByText("No upper limit is written to your role.")).toBeTruthy();
  });

  it("shows nothing without a limit", () => {
    agencyNaming({});
    const { container } = render(<ApprovalLimitNote limit={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
