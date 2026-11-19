import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AddPaymentSheet } from "./AddPaymentSheet";

let stored: Record<string, string> = {};

beforeEach(() => {
  openAgency("town");
  stored = {};
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (name === "forms_catalog_setting_read") {
      if (!(given.key in stored)) throw new mcp.McpError("setting.read: setting not found");
      return { key: given.key, value: stored[given.key] };
    }
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = () => render(<AddPaymentSheet billID="b-1" outstanding="9600" onSaved={() => undefined} onCancel={() => undefined} />);

describe("the ways to pay on the Add payment sheet", () => {
  it("are the four defaults when the owner has set none", async () => {
    open();
    for (const way of ["Cash", "Bank transfer", "Card", "Other"]) expect(await screen.findByRole("button", { name: way })).toBeInTheDocument();
  });

  it("are the owner's list when one is set", async () => {
    stored = { payment_methods: JSON.stringify(["Cash", "Mobile money"]) };
    open();
    expect(await screen.findByRole("button", { name: "Mobile money" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Card" })).not.toBeInTheDocument();
  });
});
