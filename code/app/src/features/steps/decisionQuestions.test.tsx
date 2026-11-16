import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { StartQuestion } from "../market/start/api";
import { routes } from "../../app/routes";
import type { MemberStep, StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const reasons: StartQuestion = { prompt: "What are the reasons for the decision?", answerType: "free_text", helper: "", required: true };

const stepOf = (id: string, formName: string, questions: StartQuestion[]): MemberStep => ({
  id,
  title: formName,
  formName,
  roleName: "Council member",
  workflowName: "Decision",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o9",
  recordCode: "REC-9",
  earlier: [],
  questions,
});

const permit = stepOf("decide", "Let us make the decision", [
  { prompt: "What is the decision?", answerType: "single_choice", helper: "", required: true, options: ["Grant the permit", "Refuse the permit"] },
  reasons,
]);

const grants = stepOf("grants", "The council decides on the grants", [
  { prompt: "What amount is awarded, in forints?", answerType: "currency", helper: "", required: true },
  reasons,
]);

const responds = stepOf("responds", "The council responds to the finding", [
  { prompt: "Is the finding accepted?", answerType: "single_choice", helper: "", required: true, options: ["Accepted", "Not accepted"] },
  { prompt: "What is changed in the decision?", answerType: "free_text", helper: "", required: true },
  { prompt: "By when at the latest?", answerType: "date", helper: "", required: true },
  {
    prompt: "What does it cost, in forints?",
    answerType: "currency",
    helper: "Only if the change carries a cost, for example 4 800 000 Ft for the additional works on the market square",
  },
]);

const signs = stepOf("signs", "The mayor approves and signs", [
  { prompt: "Is the reply approved and signed?", answerType: "single_choice", helper: "", required: true, options: ["Approved and signed", "Not signed"] },
  {
    prompt: "What reimbursement is requested for copying the documents, in forints?",
    answerType: "currency",
    helper: "Only if a reimbursement is requested, for example 1 200 Ft",
  },
]);

const votes = stepOf("votes", "The council decides on switching on or leaving switched off", [
  { prompt: "What does the council decide?", answerType: "single_choice", helper: "", required: true, options: ["Switch the modules on", "Leave them switched off"] },
  { prompt: "How many votes in favour?", answerType: "number", helper: "", required: true },
  { prompt: "How many votes against?", answerType: "number", helper: "", required: true },
  { prompt: "What is the reasoning for the decision?", answerType: "free_text", helper: "The reasoning carries a person's name", required: true },
]);

const submitted = vi.fn(async () => ({ done: true, next: null, orderId: "o9" }));

const show = async (step: MemberStep) => {
  const client: StepsClient = { available: async () => [step], submit: submitted };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: step.id }, { order: step.orderId })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const send = () => userEvent.click(screen.getByRole("button", { name: "Send" }));

const unitOf = (prompt: string) => screen.getByLabelText(prompt).closest(".input") as HTMLElement;

beforeEach(() => {
  submitted.mockClear();
  openAgency("municipality");
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
  localStorage.clear();
  sessionStorage.clear();
});

describe("the five decision steps show their questions on the phone form", () => {
  it("shows the council's response with pick-one rows, a date, the cost in Ft and its helper, and sends the answers keyed by prompt", async () => {
    await show(responds);
    expect(screen.getByRole("radio", { name: "Accepted" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Not accepted" })).toBeInTheDocument();
    expect(screen.getByLabelText("By when at the latest?")).toHaveAttribute("type", "date");
    expect(within(unitOf("What does it cost, in forints?")).getByText("Ft")).toBeInTheDocument();
    expect(screen.getByText(/4 800 000 Ft for the additional works on the market square/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Accepted" }));
    await userEvent.type(screen.getByLabelText("What is changed in the decision?"), "Add the market square works");
    fireEvent.change(screen.getByLabelText("By when at the latest?"), { target: { value: "2026-12-15" } });
    await userEvent.type(screen.getByLabelText("What does it cost, in forints?"), "4800000");
    await send();

    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "responds", orderId: "o9" }),
      {
        "Is the finding accepted?": "Accepted",
        "What is changed in the decision?": "Add the market square works",
        "By when at the latest?": "2026-12-15",
        "What does it cost, in forints?": "4800000",
      },
      expect.any(String),
    );
  });

  it("leaves the cost out of the answers when it is left empty", async () => {
    await show(responds);
    await userEvent.click(screen.getByRole("radio", { name: "Not accepted" }));
    await userEvent.type(screen.getByLabelText("What is changed in the decision?"), "Nothing");
    fireEvent.change(screen.getByLabelText("By when at the latest?"), { target: { value: "2026-12-15" } });
    await send();
    expect(submitted).toHaveBeenCalledWith(
      expect.anything(),
      {
        "Is the finding accepted?": "Not accepted",
        "What is changed in the decision?": "Nothing",
        "By when at the latest?": "2026-12-15",
      },
      expect.any(String),
    );
  });

  it("shows the grants amount in Ft and sends it as digits", async () => {
    await show(grants);
    expect(screen.getByLabelText("What amount is awarded, in forints?")).toHaveAttribute("type", "number");
    expect(within(unitOf("What amount is awarded, in forints?")).getByText("Ft")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("What amount is awarded, in forints?"), "2500000");
    await userEvent.type(screen.getByLabelText("What are the reasons for the decision?"), "Fits the budget");
    await send();
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "grants" }),
      { "What amount is awarded, in forints?": "2500000", "What are the reasons for the decision?": "Fits the budget" },
      expect.any(String),
    );
  });

  it("shows the mayor's reimbursement helper and Ft, and sends with the reimbursement left empty", async () => {
    await show(signs);
    expect(screen.getByText(/for example 1 200 Ft/)).toBeInTheDocument();
    expect(within(unitOf("What reimbursement is requested for copying the documents, in forints?")).getByText("Ft")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Approved and signed" }));
    await send();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ id: "signs" }), { "Is the reply approved and signed?": "Approved and signed" }, expect.any(String));
  });

  it("shows two number inputs without Ft for the votes, and sends the counts with the reasoning", async () => {
    await show(votes);
    for (const prompt of ["How many votes in favour?", "How many votes against?"]) {
      expect(screen.getByLabelText(prompt)).toHaveAttribute("type", "number");
      expect(within(unitOf(prompt)).queryByText("Ft")).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Ft")).not.toBeInTheDocument();
    expect(screen.getByText("The reasoning carries a person's name")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Switch the modules on" }));
    await userEvent.type(screen.getByLabelText("How many votes in favour?"), "7");
    await userEvent.type(screen.getByLabelText("How many votes against?"), "2");
    await userEvent.type(screen.getByLabelText("What is the reasoning for the decision?"), "Mayor Kovacs asked for it");
    await send();
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "votes" }),
      {
        "What does the council decide?": "Switch the modules on",
        "How many votes in favour?": "7",
        "How many votes against?": "2",
        "What is the reasoning for the decision?": "Mayor Kovacs asked for it",
      },
      expect.any(String),
    );
  });

  it("requires the votes' reasoning", async () => {
    await show(votes);
    await userEvent.click(screen.getByRole("radio", { name: "Leave them switched off" }));
    await userEvent.type(screen.getByLabelText("How many votes in favour?"), "3");
    await userEvent.type(screen.getByLabelText("How many votes against?"), "6");
    await send();
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(1);
    expect(submitted).not.toHaveBeenCalled();
  });

  it("needs a choice and reasons before the permit decision is sent", async () => {
    await show(permit);
    expect(screen.getByRole("radio", { name: "Grant the permit" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Refuse the permit" })).toBeInTheDocument();
    await send();
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(2);
    expect(submitted).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Refuse the permit" }));
    await userEvent.type(screen.getByLabelText("What are the reasons for the decision?"), "The plot is protected");
    await send();
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "decide" }),
      { "What is the decision?": "Refuse the permit", "What are the reasons for the decision?": "The plot is protected" },
      expect.any(String),
    );
  });

  it.each([
    ["the council's response", responds, 3],
    ["the grants", grants, 2],
    ["the mayor's signature", signs, 1],
    ["the votes", votes, 4],
    ["the permit", permit, 2],
  ])("does not send %s while its required questions are empty", async (_name, step, required) => {
    await show(step);
    await send();
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(required);
    expect(submitted).not.toHaveBeenCalled();
  });
});
