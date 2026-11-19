import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { callTool } from "../../shared/wakala/mcp";
import type { MemberStep, StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

vi.mock("../../shared/wakala/mcp", () => ({ callTool: vi.fn() }));

const mocked = callTool as any;

const closure: MemberStep = {
  id: "s1",
  title: "Close a street",
  formName: "Street closure",
  roleName: "Volunteer",
  workflowName: "Street closures",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-1",
  earlier: [],
  questions: [
    { prompt: "Which street", answerType: "address", helper: "", required: true, allowFreeText: true },
    { prompt: "Reason", answerType: "free_text", helper: "" },
  ],
};

const addresses = [
  { id: "a1", street: "Fő tér", number: "2", area: "Óváros" },
  { id: "a3", street: "Malomsor utca", number: "9", area: "Malomsor" },
];

const clientOf = (submit: StepsClient["submit"]): StepsClient => ({ available: async () => [closure], submit });

const show = async (client: StepsClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s1" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  openAgency("farmers");
  mocked.mockReset();
  mocked.mockImplementation(async (_hub: string, tool: string) => (tool === "digitaltwin_address_list" ? { items: addresses } : { items: [] }));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("a step with an address question", () => {
  it("offers the town's streets and addresses by name and sends the one picked with its reference beside the words", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "o1" }));
    await show(clientOf(submit));
    await userEvent.click(await screen.findByRole("radio", { name: "Fő tér 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit).toHaveBeenCalledWith(closure, { "Which street": "Fő tér 2" }, expect.any(String), undefined, { "Which street": "address:a1" });
  });

  it("sends words typed in the free text box with no reference", async () => {
    const submit = vi.fn(async () => ({ done: true, next: null, orderId: "o1" }));
    await show(clientOf(submit));
    await userEvent.type(await screen.findByLabelText("Something else"), "Behind the mill");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit).toHaveBeenCalledWith(closure, { "Which street": "Behind the mill" }, expect.any(String));
  });
});
