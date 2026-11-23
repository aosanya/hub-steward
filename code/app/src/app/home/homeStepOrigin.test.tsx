import { vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, forgetWide, landed, landedState, rowPagePathOf, section, sectionPathOf, setWide, showAt, stepOf, rowPage, workflowEntry, type RecordFact, type Setup } from "./agencyHome_contract_adapters";
import { StartRows } from "./StartRows";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tenders: RecordFact = { code: "RC-1", name: "Tenders", canAdd: true, questions: ["Title"], rows: [{ id: "r1", order_id: "o1", answers: { Title: "Dam" } }] };

const goNoGo = workflowEntry("go-no-go", "Go or no-go", "W-1", "Go or no-go");

const setupOf = (nodes: Setup["nodes"], over: Setup = {}): Setup => ({ nodes, records: [tenders], modules: ["taskmanager"], waitingSteps: [{ workflow: "Go or no-go", id: "s1", orderId: "" }], ...over });

const tendersSection = setupOf([section("tenders", "Tenders", [goNoGo])]);

const rowPageSetup = setupOf([section("deliver", "Deliver work", [rowPage("tender-page", "Tender", "RC-1", [workflowEntry("go-no-go", "Go or no-go", "W-1", "Go or no-go", {}, { step: "WI-1", scope: "row.order" })])])], {
  waitingSteps: [{ workflow: "Go or no-go", id: "s1", orderId: "o1" }],
});

const open = async (title: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByText(title));
  await waitFor(() => expect(landed).toBe("/a/alego/steps/s1"));
};

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a step opened from a workflow row hands over the screen it was opened from", () => {
  it("from a section's Workflows list on a phone", async () => {
    showAt(sectionPathOf(agencyId, "tenders"), tendersSection);
    await open("Go or no-go");
    expect(landedState).toEqual({ from: { path: sectionPathOf(agencyId, "tenders"), title: "Tenders" } });
  });

  it("from a section's tree on a wide screen", async () => {
    setWide(true);
    showAt(sectionPathOf(agencyId, "tenders"), tendersSection);
    await screen.findByRole("tree");
    await open("Go or no-go");
    expect(landedState).toEqual({ from: { path: sectionPathOf(agencyId, "tenders"), title: "Tenders" } });
  });

  it("from a row page", async () => {
    showAt(rowPagePathOf(agencyId, "tender-page", "r1"), rowPageSetup);
    await open("Go or no-go");
    expect(landedState).toEqual({ from: { path: rowPagePathOf(agencyId, "tender-page", "r1"), title: "Tender" } });
  });
});

describe("a step opened from My work > Start hands over Start", () => {
  it("names Start as the screen it was opened from", async () => {
    let state: unknown = null;
    const Where = () => {
      state = useLocation().state;
      return null;
    };
    const steps = [{ ...stepOf("Report a problem", "d1"), questions: [], state: "start", orderId: "", earlier: [], formName: "Problem report" }];
    await act(async () => {
      render(
        <MemoryRouter>
          <StartRows kind="farmers" start={{ openSteps: async () => [], waiting: async () => [] }} steps={{ available: async () => steps as never[] }} forms={{ waiting: async () => [], answered: async () => [] }} />
          <Where />
        </MemoryRouter>,
      );
    });
    await userEvent.click(await screen.findByText("Problem report"));
    expect(state).toEqual({ from: { path: "/a/alego/do-something", title: "Start" } });
  });
});

