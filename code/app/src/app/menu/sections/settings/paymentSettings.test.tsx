import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { loadPaymentMethods } from "../finance/paymentSettings";
import { items, routes } from "./index";
import { settingsPaths } from "./paths";

let permissions: string[] = [];

let stored: Record<string, string> = {};

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  switch (name) {
    case "agency_get_my_roles":
      return { permissions };
    case "forms_catalog_setting_read":
      if (!(given.key in stored)) throw new mcp.McpError("setting.read: setting not found");
      return { key: given.key, value: stored[given.key] };
    case "forms_catalog_setting_write":
      stored[given.key] = given.value;
      return {};
    default:
      return { items: [] };
  }
};

beforeEach(() => {
  openAgency("town");
  permissions = [];
  stored = {};
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = async () => {
  render(
    <MemoryRouter initialEntries={[settingsPaths.paymentSettings.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "Payments" });
  return screen.findByRole("region", { name: "Payments" });
};

const writes = () => vi.mocked(mcp.callTool).mock.calls.filter(([, tool]) => tool === "forms_catalog_setting_write").map(([, , args]) => args as Record<string, string>);

describe("the Payments settings page", () => {
  it("is in the Settings menu", () => {
    expect(items.map((item) => item.title)).toContain("Payments");
  });

  it("says a payment above what is owed is refused and lists the four ways to pay when nothing is set", async () => {
    const card = await open();
    expect(within(card).getByText("Refused")).toBeInTheDocument();
    expect(within(card).getByText("Cash, Bank transfer, Card, Other")).toBeInTheDocument();
  });

  it("reads what the owner set", async () => {
    stored = { payment_overpayment: "allowed", payment_methods: JSON.stringify(["Cash", "Mobile money"]) };
    const card = await open();
    expect(within(card).getByText("Allowed")).toBeInTheDocument();
    expect(within(card).getByText("Cash, Mobile money")).toBeInTheDocument();
  });

  it("offers no Save to someone who may not write settings", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("lets the owner allow overpayment and add a way to pay, and saves both", async () => {
    permissions = ["permission.override"];
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Allowed" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New way to pay" }), "Mobile money");
    await userEvent.click(screen.getByRole("button", { name: "Add way to pay" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()).toContainEqual({ key: "payment_overpayment", value: "allowed" });
    expect(writes()).toContainEqual({ key: "payment_methods", value: JSON.stringify(["Cash", "Bank transfer", "Card", "Other", "Mobile money"]) });
  });

  it("lets the owner remove a way to pay but never the last one, and refuses a repeat", async () => {
    permissions = ["permission.override"];
    await open();
    await userEvent.type(await screen.findByRole("textbox", { name: "New way to pay" }), "cash");
    await userEvent.click(screen.getByRole("button", { name: "Add way to pay" }));
    expect(await screen.findByText("Cash is already a way to pay.")).toBeInTheDocument();
    for (const way of ["Bank transfer", "Card", "Other"]) await userEvent.click(screen.getByRole("button", { name: `Remove ${way}` }));
    expect(screen.queryByRole("button", { name: "Remove Cash" })).not.toBeInTheDocument();
  });
});

describe("the ways to pay offered when adding a payment", () => {
  it("are the four defaults when nothing is set", async () => {
    expect(await loadPaymentMethods()).toEqual(["Cash", "Bank transfer", "Card", "Other"]);
  });

  it("are the owner's list when one is set, and the defaults when it cannot be read", async () => {
    stored = { payment_methods: JSON.stringify(["Cash", "Mobile money"]) };
    expect(await loadPaymentMethods()).toEqual(["Cash", "Mobile money"]);
    stored = { payment_methods: "not json" };
    expect(await loadPaymentMethods()).toEqual(["Cash", "Bank transfer", "Card", "Other"]);
  });
});
