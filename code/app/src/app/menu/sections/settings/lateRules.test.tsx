import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { settingsPaths } from "./paths";

let permissions: string[] = [];

let stored: Record<string, string> = {};

let refuseWrites = false;

const noRule = "No rule: late from the day after the due date, nobody is reminded";

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  switch (name) {
    case "agency_get_my_roles":
      return { permissions };
    case "accounting_account_list":
      return {
        items: [
          { id: "a-stall", name: "Market stalls", type: "income" },
          { id: "a-rates", name: "Rates", type: "income" },
          { id: "a-park", name: "Parking", type: "income" },
          { id: "a-bank", name: "Bank", type: "asset" },
        ],
      };
    case "actor_list_role_kinds":
      return {
        items: [
          { id: "k-fin", name: "Finance officer" },
          { id: "k-mayor", name: "Mayor" },
          { id: "k-old", name: "Old clerk", retired_at: "2026-01-01T00:00:00Z" },
        ],
      };
    case "forms_catalog_setting_read":
      return given.key in stored ? { key: given.key, value: stored[given.key] } : null;
    case "forms_catalog_setting_write":
      if (refuseWrites) throw new mcp.McpError("setting.write: the setting could not be saved");
      stored[given.key] = given.value;
      return {};
    default:
      return { items: [] };
  }
};

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

beforeEach(() => {
  openAgency("town");
  permissions = [];
  refuseWrites = false;
  stored = {
    "late_rule.a-stall": JSON.stringify({ days: 14, role: "k-fin" }),
    "late_rule.a-rates": JSON.stringify({ days: 60, role: "k-mayor" }),
  };
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const listPath = () => settingsPaths.lateRules.path();

const editPath = () => settingsPaths.lateRulesEdit.path();

const writes = () => vi.mocked(mcp.callTool).mock.calls.filter(([, tool]) => tool === "forms_catalog_setting_write");

const openList = async () => {
  openAt(listPath());
  await screen.findByRole("heading", { level: 1, name: "Late rules" });
  return screen.findByRole("region", { name: "Charges" });
};

const openEdit = async () => {
  permissions = ["permission.override"];
  openAt(editPath());
  await screen.findByRole("textbox", { name: "Market stalls days" });
};

const pickRole = async (charge: string, role: string) => {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`${charge} role`) }));
  await userEvent.click(await screen.findByRole("option", { name: role }));
};

describe("the Late rules page", () => {
  it("is in the Settings menu", () => {
    expect(items.map((item) => item.title)).toContain("Late rules");
  });

  it("shows each kind of charge with its days and the reminded role in words, and a charge with no rule saying so", async () => {
    const card = await openList();

    expect(within(card).getByText("Market stalls")).toBeInTheDocument();
    expect(within(card).getByText("Late after 14 days · reminds Finance officer")).toBeInTheDocument();
    expect(within(card).getByText("Late after 60 days · reminds Mayor")).toBeInTheDocument();
    expect(within(card).getByText("Parking")).toBeInTheDocument();
    expect(within(card).getByText(noRule)).toBeInTheDocument();
    expect(within(card).queryByText("Bank")).not.toBeInTheDocument();
  });

  it("names Edit late rules in the card footer only for someone who may write settings", async () => {
    const card = await openList();
    expect(within(card).queryByRole("button", { name: "Edit late rules" })).not.toBeInTheDocument();
    cleanup();

    permissions = ["permission.override"];
    const owned = await openList();
    expect(within(owned).getByRole("button", { name: "Edit late rules" })).toBeInTheDocument();
  });

  it("opens the one edit screen from the footer", async () => {
    permissions = ["permission.override"];
    const card = await openList();

    await userEvent.click(within(card).getByRole("button", { name: "Edit late rules" }));

    expect(await screen.findByRole("textbox", { name: "Market stalls days" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(editPath());
  });
});

describe("the Late rules edit screen", () => {
  it("fills each charge with its saved days and role, and an empty pair for a charge with no rule", async () => {
    await openEdit();

    expect(screen.getByRole("textbox", { name: "Market stalls days" })).toHaveValue("14");
    expect(screen.getByRole("button", { name: /Market stalls role/ })).toHaveTextContent("Finance officer");
    expect(screen.getByRole("textbox", { name: "Parking days" })).toHaveValue("");
  });

  it("offers only the roles still in use", async () => {
    await openEdit();

    await userEvent.click(screen.getByRole("button", { name: /Parking role/ }));

    expect(await screen.findByRole("option", { name: "Mayor" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Old clerk" })).not.toBeInTheDocument();
  });

  it("saves only the charges that changed, the role as its kind id, and returns to the page", async () => {
    await openEdit();

    await userEvent.clear(screen.getByRole("textbox", { name: "Market stalls days" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Market stalls days" }), "21");
    await userEvent.type(screen.getByRole("textbox", { name: "Parking days" }), "30");
    await pickRole("Parking", "Mayor");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(listPath()));
    expect(writes().map(([, , args]) => args)).toEqual([
      { key: "late_rule.a-stall", value: JSON.stringify({ days: 21, role: "k-fin" }) },
      { key: "late_rule.a-park", value: JSON.stringify({ days: 30, role: "k-mayor" }) },
    ]);
  });

  it("keeps Save off until something changed", async () => {
    await openEdit();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([
    ["days without a role", "Parking days", "30", "Give Parking a role to remind."],
    ["a negative number of days", "Market stalls days", "-3", "Market stalls: days must be a whole number, 0 or more."],
    ["days in words", "Market stalls days", "soon", "Market stalls: days must be a whole number, 0 or more."],
    ["a part of a day", "Market stalls days", "2.5", "Market stalls: days must be a whole number, 0 or more."],
  ])("refuses %s before saving and writes nothing", async (_name, label, typed, words) => {
    await openEdit();

    await userEvent.clear(screen.getByRole("textbox", { name: label }));
    await userEvent.type(screen.getByRole("textbox", { name: label }), typed);

    expect(screen.getByText(words)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it("refuses a role without days before saving", async () => {
    await openEdit();

    await pickRole("Parking", "Mayor");

    expect(screen.getByText("Give Parking the days after the due date.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("writes nothing and goes back on Cancel", async () => {
    await openEdit();

    await userEvent.type(screen.getByRole("textbox", { name: "Parking days" }), "30");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(listPath()));
    expect(writes()).toHaveLength(0);
  });

  it("says why when the hub refuses the write and stays on the screen", async () => {
    refuseWrites = true;
    await openEdit();

    await userEvent.clear(screen.getByRole("textbox", { name: "Market stalls days" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Market stalls days" }), "21");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the setting could not be saved")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(editPath());
  });

  it("shows no form to someone who may not write settings", async () => {
    permissions = [];
    openAt(editPath());

    await waitFor(() => expect(vi.mocked(mcp.callTool).mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByRole("textbox", { name: "Market stalls days" })).not.toBeInTheDocument();
  });
});
