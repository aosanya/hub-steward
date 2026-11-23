import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import * as mcp from "../../shared/wakala/mcp";
import { StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent, sentSteps, wasStarted } from "./sent";
import { StepPage } from "./StepPage";

const base: MemberStep = {
  id: "g-add",
  title: "Add a tender",
  formName: "Tender",
  roleName: "Tender Scout",
  workflowName: "Add a tender",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "RC-1",
  earlier: [],
  generated: true,
  rowAction: "add",
  questions: [
    { prompt: "Title", answerType: "free_text", helper: "", required: true },
    { prompt: "Value", answerType: "number", helper: "" },
    { prompt: "Open", answerType: "yes_no", helper: "" },
    { prompt: "Kind", answerType: "single_choice", helper: "", options: ["Works", "Services"] },
    { prompt: "Regions", answerType: "multi_select", helper: "", options: ["North", "South", "East"] },
    { prompt: "Photo", answerType: "photo", helper: "" },
  ],
};

const edit: MemberStep = { ...base, id: "g-edit", title: "Edit a tender", workflowName: "Edit a tender", rowAction: "edit" };

const remove: MemberStep = {
  ...base,
  id: "g-delete",
  title: "Delete a tender",
  workflowName: "Delete a tender",
  formName: "Why delete this tender",
  rowAction: "delete",
  questions: [{ prompt: "Why is it removed", answerType: "free_text", helper: "", required: true }],
};

const rows = [
  { id: "r1", answers: { Title: "Bridge", Value: "120", Open: "Yes", Kind: "Services", Regions: "North; East", Photo: "site.png" } },
  { id: "r2", answers: { Title: "Road", Value: "40", Open: "No", Kind: "Works", Regions: "South" } },
];

let landed = "";
let landedSearch = "";

const Where = () => {
  const location = useLocation();
  landed = location.pathname;
  landedSearch = location.search;
  return <p>elsewhere</p>;
};

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => {
    if (tool === "agency_list_live_record_rows") return { items: rows };
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-1", name: "Tenders", can_add_rows: true, questions: base.questions.map((q) => ({ prompt: q.prompt, answer_type: q.answerType, required: q.required === true, options: q.options })) }] };
    return { items: [] };
  });

const clientOf = (found: MemberStep[], submit: StepsClient["submit"] = vi.fn(async () => ({ done: true, next: null, orderId: "", rowId: "r9" }))): StepsClient => ({ available: async () => found, submit });

const show = async (client: StepsClient, at: string, row = "", state?: unknown) => {
  landed = "";
  landedSearch = "";
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: routes.step.path({ stepId: at }), search: row ? `?row=${row}` : "", state }]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<Where />} />
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

describe("an Add workflow", () => {
  it("sends the answers with no row, keeps no record of it as sent and lands where it was started from", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "", rowId: "r9" }));
    await show(clientOf([base], submit), "g-add", "", { from: { path: "/a/ias/home/tenders/records/RC-1", title: "Tenders" }, landing: "/a/ias/home/tenders/records/RC-1?open={row}" });
    await userEvent.type(screen.getByLabelText("Title"), "Dam");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(landed).toBe("/a/ias/home/tenders/records/RC-1"));
    expect(landedSearch).toBe("?open=r9");
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: "g-add" }), { Title: "Dam" }, expect.any(String));
    expect(sentSteps()).toEqual([]);
    expect(wasStarted("g-add")).toBe(false);
  });

  it("reads Back with the title of the place it was started from, and goes there", async () => {
    await show(clientOf([base]), "g-add", "", { from: { path: "/a/ias/home/tenders/records/RC-1", title: "Tenders" }, landing: "/a/ias/home/tenders/records/RC-1?open={row}" });
    await userEvent.click(screen.getByRole("button", { name: "‹ Tenders" }));
    expect(landed).toBe("/a/ias/home/tenders/records/RC-1");
  });

  it("goes back to the Start list as before when it was started from there", async () => {
    await show(clientOf([base]), "g-add");
    await userEvent.type(screen.getByLabelText("Title"), "Dam");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(landed).toBe("/a/ias/do-something"));
  });

  it("is titled by the workflow and keeps its form open for the next row", async () => {
    await show(clientOf([base]), "g-add");
    expect(screen.getAllByText("Add a tender").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });
});

describe("an Edit workflow", () => {
  it("starts with the row's answers: text, number, yes or no, one choice and several", async () => {
    await show(clientOf([edit]), "g-edit", "r1");
    expect(await screen.findByDisplayValue("Bridge")).toBeInTheDocument();
    expect(screen.getByLabelText("Value")).toHaveValue(120);
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Services" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "North" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "East" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "South" })).not.toBeChecked();
  });

  it("names the row it edits under the title", async () => {
    await show(clientOf([edit]), "g-edit", "r1");
    await screen.findByDisplayValue("Bridge");
    expect(screen.getAllByText("Bridge").length).toBeGreaterThan(0);
  });

  it("sends the row id with every answer again, keeping an answer the form cannot take, and lands on the replacing row", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "", rowId: "r9" }));
    await show(clientOf([edit], submit), "g-edit", "r1", { from: { path: "/a/ias/home/tenders/records/RC-1", title: "Tenders" }, landing: "/a/ias/home/tenders/records/RC-1?open={row}" });
    const title = await screen.findByDisplayValue("Bridge");
    await userEvent.clear(title);
    await userEvent.type(title, "Bridge two");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(landed).toBe("/a/ias/home/tenders/records/RC-1"));
    expect(landedSearch).toBe("?open=r9");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "g-edit", rowId: "r1" }),
      { Title: "Bridge two", Value: "120", Open: "yes", Kind: "Services", Regions: "North, East", Photo: "site.png" },
      expect.any(String),
    );
    expect(sentSteps()).toEqual([]);
  });

  it("does not carry one row's unsent changes to the next row", async () => {
    await show(clientOf([edit]), "g-edit", "r1");
    await userEvent.type(await screen.findByDisplayValue("Bridge"), " changed");
    cleanup();
    await show(clientOf([edit]), "g-edit", "r2");
    expect(await screen.findByDisplayValue("Road")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bridge changed")).not.toBeInTheDocument();
  });

  it("says the step has closed when no row is named", async () => {
    await show(clientOf([edit]), "g-edit");
    expect(await screen.findByText("This task has closed.")).toBeInTheDocument();
  });

  it("says the step has closed when the row is gone", async () => {
    await show(clientOf([edit]), "g-edit", "r404");
    expect(await screen.findByText("This task has closed.")).toBeInTheDocument();
  });

  it("says plainly that the role is not the person's when the hub refuses it", async () => {
    const submit = vi.fn(async () => {
      throw new StepRefused("role");
    });
    await show(clientOf([edit], submit), "g-edit", "r1");
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(await screen.findByText("This step is not for your role.")).toBeInTheDocument();
  });
});

describe("a Delete workflow", () => {
  it("asks only why the row is removed and sends the reason with the row id", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "" }));
    await show(clientOf([remove], submit), "g-delete", "r2", { from: { path: "/a/ias/home/tenders/records/RC-1", title: "Tenders" }, landing: "/a/ias/home/tenders/records/RC-1" });
    expect(await screen.findByLabelText("Why is it removed")).toHaveValue("");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Why is it removed"), "Withdrawn by the client");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(landed).toBe("/a/ias/home/tenders/records/RC-1"));
    expect(landedSearch).toBe("");
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: "g-delete", rowId: "r2" }), { "Why is it removed": "Withdrawn by the client" }, expect.any(String));
  });

  it("does not send a blank reason", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "" }));
    await show(clientOf([remove], submit), "g-delete", "r2");
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("This question needs an answer")).toBeInTheDocument();
  });

  it("names the row it removes under the title", async () => {
    await show(clientOf([remove], vi.fn()), "g-delete", "r2");
    await screen.findByLabelText("Why is it removed");
    expect(screen.getAllByText("Road").length).toBeGreaterThan(0);
  });
});
