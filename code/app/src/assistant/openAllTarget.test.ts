import { draftOf, listTool, openAllTarget, pendingTool, withIds, type ResultDraft } from "./results";
import { issuesPath } from "../backlogs/paths";
import { smartBacklogPath } from "../smartBacklog/paths";
import { openAgency, forgetOpenAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const backlogs = [
  { id: "b1", name: "Software", steps: ["To do"], issues: 5 },
  { id: "s1", name: "Ready to start", steps: [], issues: 9, kind: "smart" as const },
];

const draftFor = (args: Record<string, unknown>, total = 100) => draftOf(listTool, args, { total, items: [{ id: "i1", title: "DEV-001 A" }] }) as ResultDraft;

describe("where Open all goes", () => {
  it("reads the tag, the repo and the words of the call as the List's filter", () => {
    const list = draftFor({ tag: "Blocked", repo: "hub-steward", q: "import" });
    expect(openAllTarget(list, backlogs)).toEqual({ label: "Open all 100 issues", to: issuesPath("all", ["Blocked", "hub-steward"], "import"), whole: false, note: "" });
  });

  it("opens a backlog by its name or id, case aside", () => {
    expect(openAllTarget(draftFor({ backlog: "software", tag: "Blocked" }), backlogs).to).toBe(issuesPath("b1", ["Blocked"]));
    expect(openAllTarget(draftFor({ backlog: "b1" }), backlogs).to).toBe(issuesPath("b1"));
  });

  it("opens a smart backlog only when nothing else narrows it", () => {
    expect(openAllTarget(draftFor({ backlog: "Ready to start" }), backlogs).to).toBe(smartBacklogPath("s1"));
    expect(openAllTarget(draftFor({ backlog: "Ready to start", tag: "Blocked" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
  });

  it("opens All issues, as the whole, for a backlog that is not found or a step or priority filter", () => {
    expect(openAllTarget(draftFor({ backlog: "Nowhere" }), backlogs)).toEqual({ label: "Open all issues", to: issuesPath(), whole: true, note: "Opens every issue, not only these." });
    expect(openAllTarget(draftFor({ step: "Doing" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
    expect(openAllTarget(draftFor({ priority: "P1" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
  });

  it("opens All issues with the count when the call had no filter", () => {
    expect(openAllTarget(draftFor({}, 724), backlogs)).toEqual({ label: "Open all 724 issues", to: issuesPath(), whole: false, note: "" });
  });

  it("opens the List with the tag and the backlog of a pending call, and says closed issues show there too", () => {
    const pending = (args: Record<string, unknown>, total = 724) => draftOf(pendingTool, args, { total, items: [{ id: "i1", title: "DEV-001 A" }] }) as ResultDraft;
    expect(openAllTarget(pending({ tag: "mwanachama-frontend-kazi", backlog: "Software" }), backlogs)).toEqual({ label: "Open these in the List", to: issuesPath("b1", ["mwanachama-frontend-kazi"]), whole: false, note: "The List also shows closed issues." });
    expect(openAllTarget(pending({ tag: "mwanachama-frontend-kazi" }), backlogs)).toMatchObject({ to: issuesPath("all", ["mwanachama-frontend-kazi"]), whole: false });
  });

  it("opens All issues, as the whole, for a pending call with nothing to narrow it, a step or a smart backlog", () => {
    const pending = (args: Record<string, unknown>) => draftOf(pendingTool, args, { total: 724, items: [{ id: "i1", title: "DEV-001 A" }] }) as ResultDraft;
    expect(openAllTarget(pending({}), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
    expect(openAllTarget(pending({ tag: "Blocked", step: "Doing" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
    expect(openAllTarget(pending({ backlog: "Ready to start" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
  });
});

describe("a count read beside the rows of the same call", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, at) => ({ id: `i${at}`, title: `DEV-${at} A` }));
  const read = (count: number) => draftOf(pendingTool, { tag: "kazi", backlog: "Backlog" }, { total: 724, items: rows(count) }) as ResultDraft;

  it("keeps the twenty rows when the model then reads the same list with one row to count it", () => {
    const kept = withIds([read(20), read(1)], 1);
    expect(kept).toHaveLength(1);
    expect(kept[0].issues).toHaveLength(20);
  });

  it("keeps the twenty rows when the one-row read came first", () => {
    const kept = withIds([read(1), read(20)], 1);
    expect(kept).toHaveLength(1);
    expect(kept[0].issues).toHaveLength(20);
  });
});
