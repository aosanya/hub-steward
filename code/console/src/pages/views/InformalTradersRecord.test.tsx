import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { RecordsView } from "./RecordsView";
import { chooseAction } from "../../ui/pageHeader.test-support";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const informalTraders = {
  code: "RC-2",
  name: "Informal traders",
  form_name: "Informal trader",
  can_add_rows: true,
  questions: [
    { prompt: "Name or alias", answer_type: "free_text", required: true },
    { prompt: "What is sold", answer_type: "free_text", required: true },
    { prompt: "Usual place", answer_type: "free_text", required: false },
    { prompt: "Usual days", answer_type: "free_text", required: false },
    { prompt: "Neighbourhood", answer_type: "single_choice", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
    { prompt: "Status", answer_type: "single_choice", required: true, options: ["Active", "Suspended", "Closed"] },
  ],
};

const flowerStand = {
  id: "row-1",
  record_code: "RC-2",
  answers: { "Name or alias": "Marika's flower stand", "What is sold": "Flowers", "Usual place": "Market square", "Usual days": "Saturday", Neighbourhood: "Óváros", Status: "Active" },
};

const statefulHub = () => {
  const saved: Record<string, unknown>[] = [flowerStand];
  answering({
    agency_list_live_records: { items: [informalTraders] },
    agency_list_live_record_rows: () => ({ items: saved }),
    agency_add_live_record_row: (args) => {
      const row = { id: `row-${saved.length + 1}`, record_code: args.record_code, answers: args.answers };
      saved.push(row);
      return row;
    },
  });
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Records page for the Informal traders record", () => {
  it("lists the record and shows its existing trader under the prompts of its form", async () => {
    statefulHub();
    renderView("records", RecordsView);

    const record = within((await screen.findByText("Informal traders")).closest("tr") as HTMLElement);
    expect(record.getByText("Informal trader")).toBeInTheDocument();
    expect(record.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/records?record=RC-2");
  });

  it("shows the rows of RC-2 under the six prompts", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-2");

    await screen.findByText("Marika's flower stand");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Name or alias", "What is sold", "Usual place", "Usual days", "Neighbourhood", "Status"]);
    expect(callsTo("agency_list_live_record_rows")).toEqual([{ record_code: "RC-2" }]);
  });

  it("adds a trader through the form built from the six questions and lists it", async () => {
    statefulHub();
    renderView("records", RecordsView, "?record=RC-2");
    const user = userEvent.setup();
    await chooseAction("Add a row");

    await user.type(screen.getByLabelText("Name or alias *"), "Ferenc the chestnut roaster");
    await user.type(screen.getByLabelText("What is sold *"), "Roasted chestnuts");
    await user.type(screen.getByLabelText("Usual days"), "Friday");
    await user.click(screen.getByRole("radio", { name: "Határrét" }));
    await user.click(screen.getByRole("radio", { name: "Active" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Ferenc the chestnut roaster")).toBeInTheDocument();
    expect(callsTo("agency_add_live_record_row")).toEqual([
      {
        record_code: "RC-2",
        answers: {
          "Name or alias": "Ferenc the chestnut roaster",
          "What is sold": "Roasted chestnuts",
          "Usual place": "",
          "Usual days": "Friday",
          Neighbourhood: "Határrét",
          Status: "Active",
        },
      },
    ]);
    expect(screen.getByText("Marika's flower stand")).toBeInTheDocument();
  });
});
