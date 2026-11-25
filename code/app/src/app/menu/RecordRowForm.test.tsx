import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { answersKeyed, liveRecordsHub, recordFrom } from "../../shared/wakala/liveRecords.test-support";
import { RecordRowForm } from "./RecordRowForm";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const stallFields = [
  { prompt: "Stall holder", required: true },
  { prompt: "Pitch", required: true, options: ["North row", "South row"] },
  { prompt: "Note", required: false },
  { prompt: "Stall owner", required: false, people: true },
];

const people = [
  { id: "a1", display_name: "Szabó Katalin" },
  { id: "a2", first_name: "Varga", last_name: "Mária" },
];

const stalls = recordFrom("RC-9", "Stalls", [], ["Stall holder", "Pitch", "Note", "Stall owner"]);

const hubOf = (added?: unknown) => liveRecordsHub({ records: [stalls], added, otherwise: (tool) => (tool === "actor_list_actors" ? { items: people } : { items: [] }) });

const show = () =>
  render(
    <MemoryRouter initialEntries={["/form"]}>
      <Where />
      <Routes>
        <Route path="/form" element={<RecordRowForm title="Add stall" recordCode="RC-9" fields={stallFields} back={{ to: "/list", label: "Stalls" }} />} />
        <Route path="/list" element={<p>the stalls</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  called = hubOf({ id: "r1" });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("RecordRowForm", () => {
  it("builds its questions from the field list and saves a row of the record it is given", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Stall holder"), "Kert Stall");
    await user.click(screen.getByRole("radio", { name: "South row" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the stalls")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-9", answers: answersKeyed(stalls, { "Stall holder": "Kert Stall", Pitch: "South row" }) });
    expect(landed).toBe("/list");
  });

  it("keeps Save off until every required question is answered", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Stall holder"), "Kert Stall");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "North row" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("lists the agency's people by name for a person question and saves the chosen actor id", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Stall holder"), "Kert Stall");
    await user.click(screen.getByRole("radio", { name: "North row" }));
    await user.click(await screen.findByRole("button", { name: /Stall owner \(optional\)/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent?.replace(/[✓›]/g, ""))).toEqual(["No one", "Szabó Katalin", "Varga Mária"]);
    await user.click(screen.getByRole("option", { name: "Varga Mária" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("the stalls");
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-9", answers: answersKeyed(stalls, { "Stall holder": "Kert Stall", Pitch: "North row", "Stall owner": "a2" }) });
  });

  it("clears a chosen person when No one is picked again", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Stall holder"), "Kert Stall");
    await user.click(screen.getByRole("radio", { name: "South row" }));
    await user.click(await screen.findByRole("button", { name: /Stall owner \(optional\)/ }));
    await user.click(screen.getByRole("option", { name: "Szabó Katalin" }));
    await user.click(screen.getByRole("button", { name: /Stall owner \(optional\)/ }));
    await user.click(screen.getByRole("option", { name: "No one" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("the stalls");
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-9", answers: answersKeyed(stalls, { "Stall holder": "Kert Stall", Pitch: "South row" }) });
  });

  it("returns an edit to the page of the row that replaced the old one, from the id the save answers with", async () => {
    called = hubOf({ id: "r2" });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/form"]}>
        <Where />
        <Routes>
          <Route
            path="/form"
            element={<RecordRowForm title="Edit stall" recordCode="RC-9" fields={[{ prompt: "Stall holder", required: true }]} back={{ to: "/rows/r1", toSaved: (id) => `/rows/${id}`, label: "Stalls" }} edit={{ rowId: "r1", saved: { "Stall holder": "Kert Stall" } }} />}
          />
          <Route path="/rows/:id" element={<p>a row</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Stall holder"), " Two");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("a row")).toBeInTheDocument();
    expect(landed).toBe("/rows/r2");
  });

  it("keeps the old page when the save answers with no id", async () => {
    called = hubOf({});
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/form"]}>
        <Where />
        <Routes>
          <Route
            path="/form"
            element={<RecordRowForm title="Edit stall" recordCode="RC-9" fields={[{ prompt: "Stall holder", required: true }]} back={{ to: "/rows/r1", toSaved: (id) => `/rows/${id}`, label: "Stalls" }} edit={{ rowId: "r1", saved: { "Stall holder": "Kert Stall" } }} />}
          />
          <Route path="/rows/:id" element={<p>a row</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Stall holder"), " Two");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("a row")).toBeInTheDocument();
    expect(landed).toBe("/rows/r1");
  });
});
