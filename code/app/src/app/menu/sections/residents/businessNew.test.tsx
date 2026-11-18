import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; answers: Record<string, string> };

let landed = "";
let saved: Row[] = [];
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const people = [
  { id: "a1", display_name: "Szabó Katalin", status: "active" },
  { id: "a2", display_name: "Varga Mária", status: "active" },
];

const hubWith = (rows: Row[], addError?: Error) => {
  saved = rows;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_add_live_record_row") {
      if (addError) throw addError;
      const row = { id: `b${saved.length + 1}`, answers: args?.answers as Record<string, string> };
      saved = [...saved, row];
      return row;
    }
    if (tool === "actor_list_actors") return { items: people };
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-1", name: "Businesses", can_add_rows: true }] };
    return { items: saved };
  });
};

const showForm = () =>
  render(
    <MemoryRouter initialEntries={[appRoutes.businessNew.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const showList = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.businesses.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const fillRequired = async (user: ReturnType<typeof userEvent.setup>, skip = "") => {
  const text: Record<string, string> = { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01" };
  for (const [label, value] of Object.entries(text)) if (label !== skip) await user.type(screen.getByLabelText(label), value);
  if (skip !== "Neighbourhood") await user.click(screen.getByRole("radio", { name: "Malomsor" }));
  if (skip !== "Status") await user.click(screen.getByRole("radio", { name: "Active" }));
};

const addCalls = () => called.mock.calls.filter(([, tool]) => tool === "agency_add_live_record_row");

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the new business form in Residents", () => {
  it("asks the seven questions of the Business form, choosing Neighbourhood and Status from their options", () => {
    hubWith([]);
    showForm();

    for (const label of ["Trading name", "Kind of business", "Tax number", "Registration number (optional)", "Place (optional)"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Óváros", "Kertváros", "Malomsor", "Határrét", "Active", "Suspended", "Closed"]);
  });

  it("adds one row of record RC-1 with the answers by prompt, leaves out the unanswered optional ones, and lands on the list showing the new row", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    expect(screen.getByText("Bakery · Malomsor")).toBeInTheDocument();
    expect(addCalls()).toEqual([["", "agency_add_live_record_row", { record_code: "RC-1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active" } }]]);
    expect(landed).toBe(residentPaths.businesses.path());
  });

  it("sends the optional Registration number and Place when they are filled", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText("Registration number (optional)"), "01-09-123456");
    await user.type(screen.getByLabelText("Place (optional)"), "Malom utca 4");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(addCalls()[0][2]).toEqual({
      record_code: "RC-1",
      answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", "Registration number": "01-09-123456", Place: "Malom utca 4", Neighbourhood: "Malomsor", Status: "Active" },
    });
  });

  it("offers an optional Owner by name and saves the chosen person's id", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user);
    await user.click(await screen.findByRole("button", { name: /Owner \(optional\)/ }));
    await user.click(screen.getByRole("option", { name: "Varga Mária" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(addCalls()[0][2]).toEqual({
      record_code: "RC-1",
      answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active", Owner: "a2" },
    });
  });

  it("leaves Owner out of the row when no one is chosen", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user);
    await screen.findByRole("button", { name: /Owner \(optional\)/ });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(Object.keys((addCalls()[0][2] as { answers: object }).answers)).not.toContain("Owner");
  });

  it.each(["Trading name", "Kind of business", "Tax number", "Neighbourhood", "Status"])("does not let the form go while the required %s is missing", async (missing) => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user, missing);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(addCalls()).toHaveLength(0);
    expect(landed).toBe(appRoutes.businessNew.path());
  });

  it("treats a blank required answer as missing", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await fillRequired(user, "Trading name");
    await user.type(screen.getByLabelText("Trading name"), "   ");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows the hub's refusal as an alert and keeps the form with what was typed", async () => {
    const user = userEvent.setup();
    hubWith([], new mcp.McpError("agency_add_live_record_row: record not found"));
    showForm();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("record not found");
    expect(landed).toBe(appRoutes.businessNew.path());
    expect(screen.getByLabelText("Trading name")).toHaveValue("Malomsor Bakery");
    expect(screen.getByRole("radio", { name: "Malomsor" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("goes back to the Businesses list without saving", async () => {
    const user = userEvent.setup();
    hubWith([]);
    showForm();

    await user.click(screen.getByRole("button", { name: /Businesses/ }));

    expect(landed).toBe(residentPaths.businesses.path());
    expect(addCalls()).toHaveLength(0);
  });

  it("is reached from the Businesses list by the Add business button above Search when the list is not empty", async () => {
    const user = userEvent.setup();
    hubWith([{ id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" } }]);
    showList();

    await screen.findByText("Malomsor Bakery");
    await user.click(await screen.findByRole("button", { name: "Add business" }));

    expect(landed).toBe(appRoutes.businessNew.path());
  });

  it("shows only the empty card's own Add business button on an empty list", async () => {
    hubWith([]);
    showList();

    expect(await screen.findByText("No businesses yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add business" })).toHaveLength(1);
  });
});
