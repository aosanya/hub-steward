import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import * as mcp from "../../shared/wakala/mcp";
import { mcpStepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const addTender = {
  id: "add1",
  title: "Add a tender",
  kind: "fill_form",
  generated: true,
  row_action: "add",
  record_code: "tender",
  form_name: "Tender",
  state: "start",
  members: [
    { id: "p-1", name: "Amina Okoye" },
    { id: "p-2", name: "Bela Varga" },
  ],
  questions: [
    { prompt: "Tender", answer_type: "free_text", required: true },
    { prompt: "Entered by", answer_type: "single_choice", required: true, options_from: "members" },
  ],
};

const show = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "add1" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={mcpStepsClient} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  openAgency("farmers");
  vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [addTender] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("a step question that picks a person", () => {
  it("offers the members the hub listed with the step, each by name", async () => {
    await show();
    expect(await screen.findByRole("radio", { name: "Amina Okoye" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bela Varga" })).toBeInTheDocument();
  });

  it("sends the chosen member's id as the answer", async () => {
    const posted = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ done: true, row_id: "r1" }), { status: 201 }));
    await show();
    await userEvent.type(await screen.findByLabelText("Tender"), "Road survey");
    await userEvent.click(screen.getByRole("radio", { name: "Bela Varga" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const [, init] = posted.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body)).answers).toEqual({ Tender: "Road survey", "Entered by": "p-2" });
  });
});
