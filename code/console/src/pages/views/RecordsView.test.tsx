import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView, type Args } from "../spec/usersTesting";
import { RecordsView } from "./RecordsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const businesses = {
  code: "RC-1",
  name: "Businesses",
  workflow_id: "w1",
  form_name: "Business",
  can_add_rows: true,
  questions: [
    { prompt: "Trading name", answer_type: "free_text", required: true },
    { prompt: "Kind of business", answer_type: "free_text", required: true },
    { prompt: "Tax number", answer_type: "free_text", required: true },
    { prompt: "Registration number", answer_type: "free_text", required: false },
    { prompt: "Place", answer_type: "free_text", required: false },
    { prompt: "Neighbourhood", answer_type: "single_choice", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
    { prompt: "Status", answer_type: "single_choice", required: true, options: ["Active", "Suspended", "Closed"] },
  ],
};

const stalls = {
  code: "RC-2",
  name: "Stalls",
  form_name: "Stall",
  can_add_rows: false,
  questions: [{ prompt: "Stall number", answer_type: "number", required: true }],
};

const bakery = {
  id: "row-1",
  record_code: "RC-1",
  answers: {
    "Trading name": "Malomsor Bakery",
    "Kind of business": "Bakery",
    "Tax number": "12345678-1-42",
    "Registration number": "01-09-123456",
    Place: "Malom utca 4",
    Neighbourhood: "Malomsor",
    Status: "Active",
  },
};

const statefulHub = () => {
  const saved: Record<string, unknown>[] = [bakery];
  answering({
    agency_list_live_records: { items: [businesses, stalls] },
    agency_list_live_record_rows: (args: Args) => ({ items: args.record_code === "RC-1" ? saved : [] }),
    agency_add_live_record_row: (args: Args) => {
      const row = { id: `row-${saved.length + 1}`, record_code: args.record_code, answers: args.answers };
      saved.push(row);
      return row;
    },
  });
};

const fillBakery = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.type(screen.getByLabelText("Trading name *"), name);
  await user.type(screen.getByLabelText("Kind of business *"), "Greengrocer");
  await user.type(screen.getByLabelText("Tax number *"), "87654321-2-42");
  await user.type(screen.getByLabelText("Place"), "Kert sor 9");
  await user.click(screen.getByRole("radio", { name: "Kertváros" }));
  await user.click(screen.getByRole("radio", { name: "Active" }));
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Records page", () => {
  it("lists the records the agency keeps, each with its form and a link to its rows", async () => {
    statefulHub();
    renderView("records", RecordsView);

    expect(await screen.findByRole("heading", { level: 1, name: "Records" })).toBeInTheDocument();
    const first = within((await screen.findByText("Businesses")).closest("tr") as HTMLElement);
    expect(first.getByText("Business")).toBeInTheDocument();
    expect(first.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/records?record=RC-1");
    expect(screen.getByText("Stalls")).toBeInTheDocument();
    expect(callsTo("agency_list_live_records")).toHaveLength(1);
  });

  it("says there is nothing yet when the agency keeps no record", async () => {
    answering({});
    renderView("records", RecordsView);

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded, without crashing, when the records cannot be read", async () => {
    answering({ agency_list_live_records: new McpError("agency_list_live_records: record not found") });
    renderView("records", RecordsView);

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { level: 1, name: "Records" })).toBeInTheDocument();
  });
});

describe("one record open", () => {
  it("is titled by the record and shows its rows under the prompts of its form", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-1");

    expect(await screen.findByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
    await screen.findByText("Malomsor Bakery");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Trading name",
      "Kind of business",
      "Tax number",
      "Registration number",
      "Place",
      "Neighbourhood",
      "Status",
    ]);
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Malomsor Bakery", "Bakery", "12345678-1-42", "01-09-123456", "Malom utca 4", "Malomsor", "Active"]);
    expect(callsTo("agency_list_live_record_rows")).toEqual([{ record_code: "RC-1" }]);
  });

  it("says there are no rows yet for a record without any", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-2");

    expect(await screen.findByRole("heading", { level: 1, name: "Stalls" })).toBeInTheDocument();
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says there is nothing here for a record the agency does not keep", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-9");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Records" })).toBeInTheDocument();
    expect(callsTo("agency_list_live_record_rows")).toEqual([]);
  });

  it("says the rows could not be loaded, keeping the title, when the rows cannot be read", async () => {
    answering({
      agency_list_live_records: { items: [businesses] },
      agency_list_live_record_rows: new McpError("agency_list_live_record_rows: record not found"),
    });
    renderView("records", RecordsView, "?record=RC-1");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
  });

  it("offers no Add a row button on a record the caller may not add to", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-2");

    await screen.findByRole("heading", { level: 1, name: "Stalls" });
    expect(screen.queryByRole("button", { name: "Add a row" })).not.toBeInTheDocument();
  });
});

describe("adding a row", () => {
  const openForm = async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a row" }));
    return user;
  };

  it("opens a form with one field for each question of the record's form, marking the required ones", async () => {
    await openForm();

    for (const label of ["Trading name *", "Kind of business *", "Tax number *", "Registration number", "Place"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    for (const option of ["Óváros", "Kertváros", "Malomsor", "Határrét", "Active", "Suspended", "Closed"]) expect(screen.getByRole("radio", { name: option })).toBeInTheDocument();
  });

  it("adds the row through agency_add_live_record_row with the record code and the answers by prompt, then lists it", async () => {
    const user = await openForm();
    await screen.findByText("Malomsor Bakery");

    await fillBakery(user, "Kert Greengrocer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Kert Greengrocer")).toBeInTheDocument();
    expect(callsTo("agency_add_live_record_row")).toEqual([
      {
        record_code: "RC-1",
        answers: {
          "Trading name": "Kert Greengrocer",
          "Kind of business": "Greengrocer",
          "Tax number": "87654321-2-42",
          "Registration number": "",
          Place: "Kert sor 9",
          Neighbourhood: "Kertváros",
          Status: "Active",
        },
      },
    ]);
    expect(screen.getByText("Malomsor Bakery")).toBeInTheDocument();
    expect(screen.queryByLabelText("Trading name *")).not.toBeInTheDocument();
  });

  it("asks for the required answers and sends nothing while one is missing", async () => {
    const user = await openForm();

    await user.type(screen.getByLabelText("Trading name *"), "Kert Greengrocer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(callsTo("agency_add_live_record_row")).toEqual([]);
  });

  it("says the change could not be sent and keeps the form and what was typed when the hub refuses the row", async () => {
    answering({
      agency_list_live_records: { items: [businesses] },
      agency_list_live_record_rows: { items: [] },
      agency_add_live_record_row: new McpError("agency_add_live_record_row: record not found"),
    });
    renderView("records", RecordsView, "?record=RC-1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a row" }));
    await fillBakery(user, "Kert Greengrocer");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByLabelText("Trading name *")).toHaveValue("Kert Greengrocer");
  });

  it("closes the form and sends nothing when cancelled", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByLabelText("Trading name *")).not.toBeInTheDocument());
    expect(callsTo("agency_add_live_record_row")).toEqual([]);
  });
});
