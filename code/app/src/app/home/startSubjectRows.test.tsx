import { vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { MemberStep } from "../../features/steps/api";
import { StartRows } from "./StartRows";
import { agencyId, hubOf, stepOf, type RecordFact } from "./agencyHome_contract_adapters";

const projects: RecordFact = {
  code: "RC-4",
  name: "Projects",
  canAdd: true,
  questions: ["Project title"],
  rows: [
    { id: "p1", answers: { "Project title": "Alpha" } },
    { id: "p2", answers: { "Project title": "Beta" } },
  ],
};

const invoiceOf = (rowId: string, orderId: string): MemberStep => ({
  ...stepOf("Project run", "invoice-step"),
  title: "Invoice",
  formName: "Invoice",
  state: "waiting",
  orderId,
  recordCode: "RC-4",
  rowId,
  subjectRecord: "RC-4",
  earlier: [],
});

let landed = "";

const Where = () => {
  const where = useLocation();
  landed = `${where.pathname}${where.search}`;
  return null;
};

const noForms = { waiting: async () => [], answered: async () => [] };

const noStart = { openSteps: async () => [], waiting: async () => [] };

const show = async (steps: MemberStep[]) => {
  await act(async () => {
    render(
      <MemoryRouter>
        <StartRows start={noStart} steps={{ available: async () => steps }} forms={noForms} />
        <Where />
      </MemoryRouter>,
    );
  });
};

const rowsShown = () => Array.from(document.querySelectorAll<HTMLElement>(".rows .row")).map((row) => [row.querySelector(".ttl")?.textContent, row.querySelector(".meta")?.textContent ?? ""]);

beforeEach(() => {
  openAgency(agencyId);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Start rows of two waiting steps of one workflow with a subject record", () => {
  it("name the subject of each beside the step, so the two are told apart", async () => {
    hubOf({ records: [projects] });
    await show([invoiceOf("p1", "run-a"), invoiceOf("p2", "run-b")]);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(rowsShown()).toEqual([
      ["Invoice", "Alpha"],
      ["Invoice", "Beta"],
    ]);
  });

  it("still open the step of their own run", async () => {
    hubOf({ records: [projects] });
    await show([invoiceOf("p1", "run-a"), invoiceOf("p2", "run-b")]);

    await userEvent.setup().click(await screen.findByText("Beta"));

    expect(landed).toBe("/a/alego/steps/invoice-step?order=run-b");
  });

  it("stay as plain rows when the subject cannot be read", async () => {
    vi.spyOn(await import("../../shared/wakala/mcp"), "callTool").mockRejectedValue(new Error("wakala answered 500: boom"));
    await show([invoiceOf("p1", "run-a")]);

    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    expect(rowsShown()).toEqual([["Invoice", ""]]);
  });
});
