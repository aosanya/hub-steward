import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { forgetSent, markSent } from "../../features/steps/sent";
import { mcpStepsClient } from "../../features/steps/api";
import { agencyId, forgetLanded, hubOf, landed, landedSearch, recordEntry, rowPage, rowPagePathOf, rowPageRoute, RowPageScreen, section, Where, wiringOf, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

const tenders: RecordFact = {
  code: "RC-1",
  name: "Tenders",
  canAdd: true,
  questions: ["Title"],
  rows: [
    { id: "r1", order_id: "o1", answers: { Title: "Dam" } },
    { id: "r2", order_id: "o2", answers: { Title: "Bridge" } },
  ],
};

const setup: Setup = {
  nodes: [section("deliver", "Deliver work", [recordEntry("tenders", "Tenders", "RC-1"), rowPage("tender-page", "Tender", "RC-1", [])])],
  records: [tenders],
  modules: ["taskmanager"],
};

const goNoGo = {
  id: "go-no-go-step",
  title: "Go or no-go",
  kind: "fill_form",
  workflow_name: "Go or no-go",
  role_name: "Director",
  form_name: "Go or no-go",
  state: "start",
  subject_record: "RC-1",
  questions: [{ prompt: "Decision", answer_type: "free_text", required: true }],
};

const signTheBid = { ...goNoGo, id: "sign-step", title: "Sign the bid", form_name: "Sign the bid", state: "waiting", order_id: "o1" };

const showWithTheStartListed = (rowId: string, sentSteps: object[], open: object[] = [goNoGo]) => {
  const hub = hubOf(setup);
  const base = hub.getMockImplementation()!;
  hub.mockImplementation(async (agency, tool, args) =>
    tool === "agency_list_my_open_steps" ? { items: open } : tool === "agency_list_my_sent_steps" ? { items: sentSteps } : base(agency, tool, args),
  );
  return render(
    <MemoryRouter initialEntries={[rowPagePathOf(agencyId, "tender-page", rowId)]}>
      <Routes>
        <Route path={rowPageRoute} element={<RowPageScreen {...wiringOf(setup)} steps={mcpStepsClient} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
  localStorage.clear();
  forgetSent();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
  vi.restoreAllMocks();
});

describe("a subject workflow started on one tender stays on offer for the next", () => {
  it("lists Go or no-go in the second tender's Workflows after the first tender started it on this phone", async () => {
    markSent({ id: "go-no-go-step", orderId: "o1", title: "Go or no-go" });
    showWithTheStartListed("r2", []);
    const region = await screen.findByRole("region", { name: "Workflows" });
    await userEvent.setup().click(within(region).getByRole("button", { name: "Expand" }));
    expect(within(region).getByText("Go or no-go")).toBeInTheDocument();
  });

  it("lists Go or no-go in the second tender's Workflows after the hub lists the first start as sent", async () => {
    showWithTheStartListed("r2", [{ step_id: "go-no-go-step", row_id: "r1", title: "Go or no-go", sent_at: "2026-11-17T08:00:00Z" }]);
    const region = await screen.findByRole("region", { name: "Workflows" });
    const user = userEvent.setup();
    await user.click(within(region).getByRole("button", { name: "Expand" }));
    await user.click(within(region).getByText("Go or no-go"));
    expect(landed).toBe("/a/alego/steps/go-no-go-step");
    expect(landedSearch).toBe("?row=r2");
  });
});

describe("the Workflows section of a row page lists start steps only", () => {
  it("leaves out the waiting steps of subject runs, however many runs wait", async () => {
    showWithTheStartListed("r2", [], [goNoGo, signTheBid, { ...signTheBid, order_id: "o2" }]);
    const region = await screen.findByRole("region", { name: "Workflows" });
    await userEvent.setup().click(within(region).getByRole("button", { name: "Expand" }));
    expect(within(region).getAllByRole("button").filter((button) => button.classList.contains("row")).map((row) => row.textContent)).toEqual(["Go or no-go›"]);
  });
});
