import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { BacklogsPage } from "./BacklogsPage";
import { taskTools } from "./api";
import { pendingCountsOf, stepTotals, topSteps } from "./stepCounts";

const step = (name: string, issues: number) => ({ id: name.toLowerCase().replace(" ", "-"), name, issues });

const hubItems = {
  items: [
    { id: "backlog", name: "Backlog", issues: 1675, steps: [step("To do", 1301), step("Waiting", 289), step("Doing", 81), step("Done", 4), step("Cancelled", 0)] },
    { id: "docs", name: "Docs", issues: 30, steps: [step("To do", 20), step("Review", 6), step("Done", 4)] },
    { id: "swe", name: "hub-steward-swe", issues: 10, steps: [], kind: "smart" },
    { id: "hm", name: "hungarian-municipality", issues: 43, steps: [], kind: "smart" },
  ],
};

const pendingFor = (backlog: string) =>
  backlog === "swe"
    ? { total: 6, by_step: [{ name: "To do", count: 1 }, { name: "Doing", count: 5 }] }
    : { total: 43, by_step: [{ name: "Waiting", count: 40 }, { name: "To do", count: 3 }] };

const answering = (pending: (backlog: string) => unknown = pendingFor) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === taskTools.backlogs) return hubItems;
    if (tool === taskTools.pending) return pending(String(args.backlog));
    return { items: [], modules: [] };
  }) as never);

const openList = () =>
  render(
    <MemoryRouter>
      <BacklogsPage manage={{ mayManage: async () => false } as never} />
    </MemoryRouter>,
  );

const bubblesOf = (title: string) =>
  Array.from(screen.getByText(title).closest(".row")!.querySelectorAll(".step-counts .chip")).map((chip) => chip.textContent);

afterEach(() => vi.restoreAllMocks());

describe("topSteps", () => {
  it("keeps the five most populous steps, most populous first, and drops the empty ones", () => {
    const counts = ["a", "b", "c", "d", "e", "f", "g"].map((name, at) => ({ name, issues: at === 6 ? 0 : at + 1 }));
    expect(topSteps(counts).map((one) => one.name)).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("keeps the order of the steps between equal counts", () => {
    expect(topSteps([{ name: "To do", issues: 2 }, { name: "Doing", issues: 2 }, { name: "Done", issues: 3 }]).map((one) => one.name)).toEqual(["Done", "To do", "Doing"]);
  });
});

describe("stepTotals", () => {
  it("adds the steps of the backlogs with steps up by name and ignores a smart backlog", () => {
    const totals = stepTotals([
      { id: "a", name: "A", steps: ["To do", "Done"], issues: 5, counts: [{ name: "To do", issues: 3 }, { name: "Done", issues: 2 }] },
      { id: "b", name: "B", steps: ["To do", "Review"], issues: 4, counts: [{ name: "To do", issues: 1 }, { name: "Review", issues: 3 }] },
      { id: "s", name: "S", steps: [], issues: 9, kind: "smart" },
    ]);
    expect(totals).toEqual([{ name: "To do", issues: 4 }, { name: "Done", issues: 2 }, { name: "Review", issues: 3 }]);
  });
});

describe("pendingCountsOf", () => {
  it("reads the open steps and calls the rest of the row's count Done", () => {
    expect(pendingCountsOf({ total: 6, by_step: [{ name: "To do", count: 1 }, { name: "Doing", count: 5 }] }, 10)).toEqual([
      { name: "To do", issues: 1 },
      { name: "Doing", issues: 5 },
      { name: "Done", issues: 4 },
    ]);
  });

  it("adds no Done when the open issues are the whole count, and nothing for an unreadable reply", () => {
    expect(pendingCountsOf({ total: 2, by_step: [{ name: "To do", count: 2 }] }, 2)).toEqual([{ name: "To do", issues: 2 }]);
    expect(pendingCountsOf("down", 2)).toEqual([]);
  });
});

describe("step bubbles on the Backlogs list", () => {
  it("shows the Backlog row's step counts from the hub's backlog list, most populous first, none for an empty step", async () => {
    answering();
    openList();
    await screen.findByText("Docs");
    await waitFor(() => expect(bubblesOf("Backlog")).toEqual(["To do 1301", "Waiting 289", "Doing 81", "Done 4"]));
  });

  it("shows All issues the backlogs' steps added up by name", async () => {
    answering();
    openList();
    await screen.findByText("Docs");
    expect(bubblesOf("All issues")).toEqual(["To do 1321", "Waiting 289", "Doing 81", "Done 8", "Review 6"]);
  });

  it("shows a smart row its open steps from one pending call and the rest as Done", async () => {
    const spy = answering();
    openList();
    await waitFor(() => expect(bubblesOf("hub-steward-swe")).toEqual(["Doing 5", "Done 4", "To do 1"]));
    expect(bubblesOf("hungarian-municipality")).toEqual(["Waiting 40", "To do 3"]);
    const pending = spy.mock.calls.filter((call) => call[1] === taskTools.pending);
    expect(pending.map((call) => (call[2] as any).backlog).sort()).toEqual(["hm", "swe"]);
    expect(spy.mock.calls.some((call) => call[1] === taskTools.list)).toBe(false);
  });

  it("draws every bubble as the app's neutral Chip", async () => {
    answering();
    openList();
    await screen.findByText("Docs");
    const chips = Array.from(screen.getByText("Backlog").closest(".row")!.querySelectorAll(".step-counts .chip"));
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => expect(chip.className).toBe("chip"));
  });

  it("keeps a smart row and its Smart pill when its counts cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
      if (tool === taskTools.backlogs) return hubItems;
      if (tool === taskTools.pending) throw new Error("down");
      return { items: [], modules: [] };
    }) as never);
    openList();
    expect(await screen.findByText("hub-steward-swe")).toBeInTheDocument();
    expect(screen.getAllByText("Smart")).toHaveLength(2);
    expect(bubblesOf("hub-steward-swe")).toEqual([]);
    expect(bubblesOf("Backlog")).toEqual(["To do 1301", "Waiting 289", "Doing 81", "Done 4"]);
  });
});
