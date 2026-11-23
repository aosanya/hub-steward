import { filesEntry, recordEntry, rowPage, section, workflowEntry, type HomeNode, type RecordFact, type RowStepFact, type Setup } from "./agencyHome_contract_adapters";

export const plots: RecordFact = {
  code: "RC-1",
  name: "Plots",
  canAdd: true,
  workflowId: "wf-care",
  questions: ["Plot name", "Crop", "Village", "Soil notes"],
  rows: [
    { id: "r1", order_id: "o1", answers: { "Plot name": "Hilltop", Crop: "Maize", Village: "Alego", "Soil notes": "Red loam" } },
    { id: "r2", order_id: "o2", answers: { "Plot name": "Lakeside", Crop: "Rice", Village: "Usonga", "Soil notes": "Clay" } },
  ],
};

export const seeds: RecordFact = {
  code: "RC-2",
  name: "Seeds",
  canAdd: false,
  workflowId: "wf-seed",
  questions: ["Seed", "Supplier"],
  rows: [{ id: "s1", answers: { Seed: "Maize hybrid", Supplier: "Agro Ltd" } }],
};

export const visits: RecordFact = {
  code: "RC-3",
  name: "Visits",
  canAdd: true,
  questions: ["Visit", "Plot"],
  rows: [{ id: "v1", answers: { Visit: "Monday", Plot: "Hilltop" } }],
};

export const manyPlots = (count: number): RecordFact => ({
  ...plots,
  rows: Array.from({ length: count }, (_, at) => ({ id: `m${at}`, answers: { "Plot name": `Plot ${at + 1}`, Crop: "Maize", Village: "Alego", "Soil notes": "Loam" } })),
});

export const fieldWork = (): HomeNode[] => [
  section("field-work", "Field work", [
    recordEntry("plots", "Plots", "RC-1"),
    section("seed-store", "Seed store", [recordEntry("seeds", "Seeds", "RC-2"), workflowEntry("order-seed", "Order seed", "W-4", "Seed order", {}, { workflow_id: "wf-seed" })]),
    filesEntry("field-files", "Field files"),
    workflowEntry("check-boundary", "Check the boundary", "W-1", "Plot care", {}, { workflow_id: "wf-care" }),
    workflowEntry("report-pest", "Report a pest", "W-2", "Pest report", {}, { workflow_id: "wf-pest" }),
    rowPage("plot-page", "Plot", "RC-1", [
      workflowEntry("record-visit", "Record a visit", "W-3", "Visit", {}, { scope: "row.order", workflow_id: "wf-visit" }),
      recordEntry("plot-visits", "Visits to this plot", "RC-3", {}, [{ question: "Plot", operator: "is", value: { row: "Plot name" } }]),
    ]),
  ]),
];

export const plotSteps: RowStepFact[] = [
  { id: "gen-add-plots", record: "RC-1", action: "add", name: "Add a plot" },
  { id: "gen-edit-plots", record: "RC-1", action: "edit", name: "Edit a plot" },
  { id: "gen-delete-plots", record: "RC-1", action: "delete", name: "Delete a plot" },
];

export const seedSteps: RowStepFact[] = [{ id: "gen-add-seeds", record: "RC-2", action: "add", name: "Add a seed" }];

export const fieldSetup = (over: Setup = {}): Setup => ({
  nodes: fieldWork(),
  records: [plots, seeds, visits],
  files: true,
  modules: ["taskmanager"],
  rowSteps: plotSteps,
  openWorkflows: ["Plot care", "Pest report", "Visit", "Seed order"],
  waitingSteps: [
    { workflow: "Plot care", id: "s-care-o1", orderId: "o1" },
    { workflow: "Plot care", id: "s-care-o2", orderId: "o2" },
    { workflow: "Visit", id: "s-visit-o1", orderId: "o1" },
  ],
  ...over,
});
