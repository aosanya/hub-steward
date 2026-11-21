import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, landed, landedSearch, rowPage, rowPagePathOf, section, showAt, useLanguageCode, waitingPathOf, workflowEntry, type HomeNode, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const projects: RecordFact = {
  code: "RC-4",
  name: "Projects",
  canAdd: true,
  questions: ["Project title", "Client"],
  rows: [
    { id: "p1", order_id: "o1", answers: { "Project title": "Alpha", Client: "Kisumu County" } },
    { id: "p2", order_id: "o2", answers: { "Project title": "Beta", Client: "Nairobi Water" } },
    { id: "p3", answers: { "Project title": "Gamma", Client: "Mombasa Port" } },
  ],
};

const scoped = (more: Partial<{ step: string; scope: string }> = {}): HomeNode[] => [
  section("deliver", "Deliver work", [
    rowPage("project-page", "Project", "RC-4", [workflowEntry("report", "Progress report", "W-7", "Progress report", {}, { step: "WI-48", scope: "row.order", ...more })]),
  ]),
];

const setupOf = (over: Setup = {}): Setup => ({ nodes: scoped(), records: [projects], modules: ["taskmanager"], ...over });

const waiting = (id: string, orderId: string) => ({ workflow: "Progress report", id, orderId });

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a workflow entry with scope row.order inside a row page", () => {
  it("opens the item of this row's run when several runs wait", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ waitingSteps: [waiting("s-o2", "o2"), waiting("s-o1", "o1")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/steps/s-o1");
    expect(landedSearch).toBe("?order=o1");
  });

  it("opens the item of the other row's run on the other row's page", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p2"), setupOf({ waitingSteps: [waiting("s-o2", "o2"), waiting("s-o1", "o1")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/steps/s-o2");
    expect(landedSearch).toBe("?order=o2");
  });

  it("never opens another row's item when this row's run has none waiting", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ waitingSteps: [waiting("s-o2", "o2")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).not.toBe("/a/alego/steps/s-o2");
  });

  it("matches no item for a row that has no order", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p3"), setupOf({ waitingSteps: [waiting("s-o1", "o1")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).not.toBe("/a/alego/steps/s-o1");
  });

  it("lists the person's items when several of this row's run wait", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ waitingSteps: [waiting("s-a", "o1"), waiting("s-b", "o1")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/do-something");
  });

  it("is still drawn on the page when this row's run has nothing waiting", async () => {
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ waitingSteps: [waiting("s-o2", "o2")] }));
    expect(await screen.findByText("Progress report")).toBeInTheDocument();
  });
});

describe("a workflow entry without a scope", () => {
  it("opens its one waiting item, whatever order it belongs to", async () => {
    const user = userEvent.setup();
    const nodes = scoped();
    ((nodes[0].entries as HomeNode[])[0].entries as HomeNode[])[0] = workflowEntry("report", "Progress report", "W-7", "Progress report", {}, { step: "WI-48" });
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ nodes, waitingSteps: [waiting("s-o2", "o2")] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/steps/s-o2");
    expect(landedSearch).toBe("?order=o2");
  });
});

describe("a workflow entry whose one open step has no run yet", () => {
  it("opens the step's own screen, not the market start form", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "project-page", "p3"), setupOf({ nodes: scoped({ scope: undefined }), waitingSteps: [{ workflow: "Progress report", id: "s-free", orderId: "" }] }));
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/steps/s-free");
  });
});

describe("a workflow entry with nothing waiting", () => {
  const nothingWaiting = (over: Setup = {}) => showAt(rowPagePathOf(agencyId, "project-page", "p1"), setupOf({ waitingSteps: [waiting("s-o2", "o2")], ...over }));

  it("opens an empty card that says nothing is waiting, not another row's item", async () => {
    const user = userEvent.setup();
    const { container } = nothingWaiting();
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe(waitingPathOf(agencyId, "report"));
    expect(landedSearch).toBe("?row=p1");
    await waitFor(() => expect(container.querySelector(".card.empty")?.textContent).toBe("Nothing is waiting."));
    expect(screen.getByRole("heading", { level: 1, name: "Progress report" })).toBeInTheDocument();
  });

  it("says it in the person's language", async () => {
    useLanguageCode("sw");
    const user = userEvent.setup();
    const { container } = nothingWaiting();
    await user.click(await screen.findByText("Progress report"));
    await waitFor(() => expect(container.querySelector(".card.empty")?.textContent).toBe("Hakuna kinachosubiri."));
  });

  it("says it in Hungarian too", async () => {
    useLanguageCode("hu");
    const user = userEvent.setup();
    const { container } = nothingWaiting();
    await user.click(await screen.findByText("Progress report"));
    await waitFor(() => expect(container.querySelector(".card.empty")?.textContent).toBe("Semmi sem vár."));
  });

  it("goes back to the row page it was opened from", async () => {
    const user = userEvent.setup();
    nothingWaiting();
    await user.click(await screen.findByText("Progress report"));
    await user.click(await screen.findByRole("button", { name: "‹ Project" }));
    expect(landed).toBe(rowPagePathOf(agencyId, "project-page", "p1"));
  });

  it("opens the start screen instead when the person holds a first step of the workflow", async () => {
    const user = userEvent.setup();
    nothingWaiting({ openWorkflows: ["Progress report"] });
    await user.click(await screen.findByText("Progress report"));
    expect(landed).toBe("/a/alego/do-something");
  });

  it("goes to Home from an entry key the declaration does not hold", async () => {
    showAt(waitingPathOf(agencyId, "no-such-entry", "p1"), setupOf());
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });

  it("goes to Home from the key of an entry that is not a workflow", async () => {
    showAt(waitingPathOf(agencyId, "project-page", "p1"), setupOf());
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });
});
