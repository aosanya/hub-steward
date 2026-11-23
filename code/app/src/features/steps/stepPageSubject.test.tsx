import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import * as mcp from "../../shared/wakala/mcp";
import type { MemberStep, StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const goOrNoGo: MemberStep = {
  id: "s-go",
  title: "Go or no-go",
  formName: "Go or no-go",
  roleName: "Bid Manager",
  workflowName: "Tender pipeline",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "RC-1",
  subjectRecord: "RC-1",
  rowId: "r1",
  earlier: [],
  questions: [
    { prompt: "Tender title", answerType: "free_text", helper: "", required: true },
    { prompt: "Decision", answerType: "single_choice", helper: "", required: true, options: ["Go", "No-go"] },
  ],
};

const review: MemberStep = {
  ...goOrNoGo,
  id: "s-review",
  title: "Review the bid",
  formName: "Review the bid",
  state: "waiting",
  orderId: "o-1",
  questions: [{ prompt: "Reviewer note", answerType: "free_text", helper: "" }],
};

const withoutRow: MemberStep = { ...goOrNoGo, id: "s-plain", recordCode: "", subjectRecord: undefined, rowId: undefined };

const firstStep: MemberStep = { ...goOrNoGo, id: "s-first", rowId: undefined };

const oldRun: MemberStep = { ...review, id: "s-old", recordCode: "", rowId: undefined, orderId: "o-9", questions: goOrNoGo.questions };

const rows = [
  { id: "r1", answers: { "Tender title": "Bridge" } },
  { id: "r2", answers: { "Tender title": "Road" } },
];

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => {
    if (tool === "agency_list_live_record_rows") return { items: rows };
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-1", name: "Tenders", questions: [{ prompt: "Tender title", answer_type: "free_text", required: true }] }] };
    return { items: [] };
  });

const clientOf = (found: MemberStep[], submit: StepsClient["submit"] = vi.fn(async () => ({ done: true, next: null, orderId: "" }))): StepsClient => ({ available: async () => found, submit });

const show = async (client: StepsClient, at: string, order = "", row = "") => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: routes.step.path({ stepId: at }), search: new URLSearchParams({ ...(order ? { order } : {}), ...(row ? { row } : {}) }).toString().replace(/^(?=.)/, "?") }]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  openAgency("ias");
  hub();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
  window.localStorage.clear();
});

describe("a step of a workflow with a subject record", () => {
  it("shows the row it works on under the heading and does not ask for the tender title", async () => {
    await show(clientOf([goOrNoGo]), "s-go");
    expect(await screen.findByText("Bridge")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tender title")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Go" })).toBeInTheDocument();
  });

  it("shows the same row on a later step of the run", async () => {
    await show(clientOf([review]), "s-review", "o-1");
    expect(await screen.findByText("Bridge")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviewer note")).toBeInTheDocument();
  });

  it("sends the answers it asked for with the row, and does not send the tender title", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "" }));
    await show(clientOf([goOrNoGo], submit), "s-go");
    await userEvent.click(await screen.findByRole("radio", { name: "Go" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: "s-go", rowId: "r1" }), { Decision: "Go" }, expect.any(String));
  });

  it("takes the row of the first step from the page address, shows it and does not ask for the tender title", async () => {
    await show(clientOf([firstStep]), "s-first", "", "r1");
    expect(await screen.findByText("Bridge")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tender title")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Go" })).toBeInTheDocument();
  });

  it("sends the row of the first step from the page address with the answers", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "" }));
    await show(clientOf([firstStep], submit), "s-first", "", "r1");
    await userEvent.click(await screen.findByRole("radio", { name: "Go" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: "s-first", rowId: "r1" }), { Decision: "Go" }, expect.any(String));
  });

  it("shows the plain form of a waiting step of a run started without a row, asks every question and sends no row", async () => {
    const submit = vi.fn(async (..._given: Parameters<StepsClient["submit"]>) => ({ done: true, next: null, orderId: "" }));
    await show(clientOf([oldRun], submit), "s-old", "o-9");
    await userEvent.type(await screen.findByLabelText("Tender title"), "Bridge");
    await userEvent.click(screen.getByRole("radio", { name: "Go" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(screen.queryByText("This task has closed.")).not.toBeInTheDocument();
    expect(submit.mock.calls[0][0].rowId).toBeUndefined();
    expect(submit.mock.calls[0][1]).toEqual({ "Tender title": "Bridge", Decision: "Go" });
  });

  it("asks every question when the step carries no row", async () => {
    await show(clientOf([withoutRow]), "s-plain");
    expect(await screen.findByLabelText("Tender title")).toBeInTheDocument();
  });
});
