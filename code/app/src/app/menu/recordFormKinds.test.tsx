import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { RecordRowForm } from "./RecordRowForm";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const fields = [
  { prompt: "What was done", required: true },
  { prompt: "Date done", required: true, kind: "date" as const },
  { prompt: "Cost", required: false, kind: "number" as const },
];

const show = () =>
  render(
    <MemoryRouter initialEntries={["/form"]}>
      <Routes>
        <Route path="/form" element={<RecordRowForm title="Add maintenance" recordCode="RC-268" fields={fields} back={{ to: "/list", label: "Asset" }} />} />
        <Route path="/list" element={<p>the asset</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockResolvedValue({ id: "r1" });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("RecordRowForm date and number questions", () => {
  it("draws a date input for a date question and a number input for a currency question", () => {
    show();

    expect(screen.getByLabelText("Date done")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Cost (optional)")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("What was done")).toHaveAttribute("type", "text");
  });

  it("saves the date as year-month-day and the cost as a number text", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("What was done"), "Replaced the lamp");
    await user.type(screen.getByLabelText("Date done"), "2026-11-12");
    await user.type(screen.getByLabelText("Cost (optional)"), "18500");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the asset")).toBeInTheDocument();
    expect(mcp.callTool).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-268", answers: { "What was done": "Replaced the lamp", "Date done": "2026-11-12", Cost: "18500" } });
  });
});
