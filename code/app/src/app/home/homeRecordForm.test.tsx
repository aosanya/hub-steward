import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { HomeRecordForm } from "./HomeRecordForm";
import { HomeRecordRows } from "./HomeRecordRows";
import { agencyId, forgetLanded, hubOf, landed, recordEntry, recordPathOf, section, Where, type HomeNode, type QuestionFact, type RecordFact } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Asked = { prompt: string; answer_type: string; required: boolean; options?: string[] };

const addTool = "agency_add_live_record_row";

const fieldsOf = (questions: Asked[], over: Partial<RecordFact> = {}): RecordFact => ({
  code: "RC-1",
  name: "Farms",
  canAdd: true,
  questions: questions as QuestionFact[],
  rows: [{ id: "r1", answers: { "Farm name": "Green Acres", Crops: "Maize; Beans", Photo: "gate.png" } }],
  ...over,
});

const nodes = (where?: { question: string; operator: string; value: string }[]): HomeNode[] => [section("registers", "Registers", [recordEntry("farms", "All farms", "RC-1", {}, where)])];

const open = (path: string, record: RecordFact, extra: Partial<Parameters<typeof hubOf>[0]> = {}) => {
  const hub = hubOf({ nodes: nodes(), records: [record], ...extra });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/home/:inKey/records/:code" element={<HomeRecordRows />} />
        <Route path="/a/:agencyId/home/:inKey/records/:code/new" element={<HomeRecordForm />} />
        <Route path="/a/:agencyId/home/:inKey/records/:code/:rowId/edit" element={<HomeRecordForm />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  return hub;
};

const listPath = recordPathOf(agencyId, "registers", "RC-1");

const saved = (hub: ReturnType<typeof hubOf>) => hub.mock.calls.filter(([, tool]) => tool === addTool).map(([, , args]) => args as { record_code: string; answers: Record<string, string>; replaces?: string });

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the add form of a declared record", () => {
  it("saves the answers of a text, number, date and time question under the record code as written", async () => {
    const user = userEvent.setup();
    const hub = open(`${listPath}/new`, fieldsOf([
      { prompt: "Farm name", answer_type: "free_text", required: true },
      { prompt: "Hectares", answer_type: "number", required: false },
      { prompt: "Cost", answer_type: "currency", required: false },
      { prompt: "Planted", answer_type: "date", required: false },
      { prompt: "Opens", answer_type: "time", required: false },
    ]));
    await user.type(await screen.findByLabelText("Farm name"), "Lakeside");
    await user.type(screen.getByLabelText("Hectares (optional)"), "4");
    await user.type(screen.getByLabelText("Cost (optional)"), "120");
    await user.type(screen.getByLabelText("Planted (optional)"), "2026-03-01");
    await user.type(screen.getByLabelText("Opens (optional)"), "08:30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(landed).toBe(listPath));
    expect(saved(hub)).toEqual([{ record_code: "RC-1", answers: { "Farm name": "Lakeside", Hectares: "4", Cost: "120", Planted: "2026-03-01", Opens: "08:30" } }]);
  });

  it("offers Yes and No for a yes_no question and the options for a single choice", async () => {
    const user = userEvent.setup();
    const hub = open(`${listPath}/new`, fieldsOf([
      { prompt: "Irrigated", answer_type: "yes_no", required: true },
      { prompt: "Soil", answer_type: "single_choice", required: true, options: ["Clay", "Loam"] },
    ]));
    await user.click(await screen.findByLabelText("Yes"));
    await user.click(screen.getByLabelText("Loam"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved(hub)).toHaveLength(1));
    expect(saved(hub)[0].answers).toEqual({ Irrigated: "Yes", Soil: "Loam" });
  });

  it("keeps the ticked options of a multi_select question joined with a semicolon and a space, in the order of the options", async () => {
    const user = userEvent.setup();
    const hub = open(`${listPath}/new`, fieldsOf([{ prompt: "Crops", answer_type: "multi_select", required: true, options: ["Maize", "Beans", "Rice"] }]));
    await user.click(await screen.findByLabelText("Rice"));
    await user.click(screen.getByLabelText("Maize"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved(hub)).toHaveLength(1));
    expect(saved(hub)[0].answers).toEqual({ Crops: "Maize; Rice" });
  });

  it.each(["photo", "file", "time_range", "address"])("leaves out a %s question", async (answerType) => {
    open(`${listPath}/new`, fieldsOf([{ prompt: "Farm name", answer_type: "free_text", required: true }, { prompt: "Extra", answer_type: answerType, required: false }]));
    await screen.findByLabelText("Farm name");
    expect(screen.queryByText(/Extra/)).not.toBeInTheDocument();
  });

  it("is refused to a person who may not add rows", async () => {
    open(`${listPath}/new`, fieldsOf([{ prompt: "Farm name", answer_type: "free_text", required: true }], { canAdd: false }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("is refused for a record with a required question the form cannot take", async () => {
    open(`${listPath}/new`, fieldsOf([{ prompt: "Farm name", answer_type: "free_text", required: true }, { prompt: "Gate", answer_type: "photo", required: true }]));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("starts with the answers a narrowed list names with is", async () => {
    const hub = open(`${listPath}/new`, fieldsOf([{ prompt: "Farm name", answer_type: "free_text", required: false }, { prompt: "Village", answer_type: "free_text", required: false }]), { nodes: nodes([{ question: "Village", operator: "is", value: "Alego" }]) });
    expect(await screen.findByDisplayValue("Alego")).toBeInTheDocument();
    expect(saved(hub)).toEqual([]);
  });
});

describe("the edit form of a declared record", () => {
  const record = fieldsOf([
    { prompt: "Farm name", answer_type: "free_text", required: true },
    { prompt: "Crops", answer_type: "multi_select", required: false, options: ["Maize", "Beans", "Rice"] },
    { prompt: "Photo", answer_type: "photo", required: false },
  ]);

  it("starts with the saved answers, and saves a replacing row that keeps an answer the form cannot take", async () => {
    const user = userEvent.setup();
    const hub = open(`${listPath}/r1/edit`, record);
    const name = await screen.findByDisplayValue("Green Acres");
    expect(screen.getByLabelText("Maize")).toBeChecked();
    expect(screen.getByLabelText("Beans")).toBeChecked();
    await user.clear(name);
    await user.type(name, "Green Acres Two");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved(hub)).toHaveLength(1));
    expect(saved(hub)[0]).toEqual({ record_code: "RC-1", answers: { "Farm name": "Green Acres Two", Crops: "Maize; Beans", Photo: "gate.png" }, replaces: "r1" });
  });
});
