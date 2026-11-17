import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
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
];

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
  called = vi.spyOn(mcp, "callTool").mockResolvedValue({ id: "r1" });
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
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-9", answers: { "Stall holder": "Kert Stall", Pitch: "South row" } });
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
});
