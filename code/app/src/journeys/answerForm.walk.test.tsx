import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Answer, AnsweredForm, FormQuestion, FormsClient, StandingForm, WaitingForm } from "../forms/api";
import { FormsProvider } from "../forms/context";

beforeEach(() => {
  window.localStorage.clear();
  openAgency("walk-agency");
});

afterEach(() => {
  forgetOpenAgency();
  window.localStorage.clear();
});

const day = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();
const dayOf = (iso: string) => iso.slice(0, 10);

const waitingForm = (form_id: string, title: string, closes_at: string, extra: Partial<WaitingForm> = {}): WaitingForm => ({
  form_id,
  title,
  closes_at,
  questions: 2,
  answered: false,
  unanswered_as: [],
  ...extra,
});

const questionsOf: Record<string, FormQuestion[]> = {
  borehole: [
    { id: "q1", prompt: "How many jerrycans a week", answer_type: "number", required: true, options: [] },
    { id: "q2", prompt: "Which days", answer_type: "multi_select", required: false, options: [{ id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }] },
  ],
  pledge: [
    { id: "p1", prompt: "What will you pledge", answer_type: "free_text", required: true, options: [] },
    { id: "p2", prompt: "Anything we should know", answer_type: "free_text", required: false, options: [] },
  ],
  delivery: [
    { id: "d1", prompt: "Pickup", answer_type: "free_text", required: true, options: [] },
    { id: "d2", prompt: "Destination", answer_type: "free_text", required: true, options: [] },
  ],
};

const freshClient = () => {
  const state = {
    waiting: [
      waitingForm("pledge", "Burial fund pledge", inDays(30), { publisher_name: "Otieno Achieng" }),
      waitingForm("borehole", "Borehole contribution", inDays(2), { publishing_authority: "Treasurer, Kilimani Ward", group: "Kilimani Ward" }),
    ] as WaitingForm[],
    answered: [
      { send_id: "s0", form_id: "old-open", title: "Welcome form", closes_at: inDays(10), open: true, answered_at: "2026-10-01T10:00:00Z" },
      { send_id: "s00", form_id: "old-closed", title: "Seed order form", closes_at: "2026-09-20T00:00:00Z", open: false, answered_at: "2026-09-15T10:00:00Z" },
    ] as AnsweredForm[],
    standing: [{ form_id: "delivery", title: "Ask for a delivery", landing: "thread" }] as StandingForm[],
    sent: [] as Array<{ formId: string; answers: Answer[] }>,
  };
  const client: FormsClient = {
    waiting: async () => [...state.waiting].sort((a, b) => a.closes_at.localeCompare(b.closes_at)),
    answered: async () => [...state.answered],
    standing: async () => state.standing,
    questions: async (formId) => questionsOf[formId] ?? [],
    submit: async (formId, answers) => {
      state.sent.push({ formId, answers });
      const form = state.waiting.find((f) => f.form_id === formId);
      if (form) {
        state.waiting = state.waiting.filter((f) => f.form_id !== formId);
        state.answered = [...state.answered, { send_id: `s-${formId}`, form_id: formId, title: form.title, closes_at: form.closes_at, open: true, answered_at: new Date().toISOString() }];
      }
    },
  };
  return { state, client };
};

const open = (client: FormsClient, path = "/a/walk-agency/forms") =>
  render(
    <FormsProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </FormsProvider>,
  );

const click = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

describe("journey 24, Answer a form", () => {
  it("step 1: lists the open forms closing soonest first under Closes this week and Later, with sender, count and date", async () => {
    const { state, client } = freshClient();
    open(client);
    const soon = await screen.findByRole("button", { name: /Borehole contribution/ });
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Closes this week", "Later", "Ask for something"]);
    expect(soon).toHaveTextContent(`Kilimani Ward · Treasurer, Kilimani Ward2 questions, closes ${dayOf(state.waiting[1].closes_at)}`);
    expect(soon).toHaveTextContent("New");
    expect(screen.getByRole("button", { name: /Burial fund pledge/ })).toHaveTextContent(`Otieno Achieng2 questions, closes ${dayOf(state.waiting[0].closes_at)}`);
    expect(screen.getByRole("button", { name: "Waiting · 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answered · 1" })).toBeInTheDocument();
  });

  it("step 1: marks a form with answers kept on the phone as a Draft", async () => {
    window.localStorage.setItem("hs-form-draft-walk-agency-pledge", JSON.stringify({ p1: { text: "Two bags", options: [] } }));
    const { client } = freshClient();
    open(client);
    expect(await screen.findByText("Draft · 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("steps 2 and 3: answers one question at a time, keeps the answers, reviews them and edits one before sending", async () => {
    const { state, client } = freshClient();
    open(client);
    await click(/Borehole contribution/);
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
    await click("Next");
    expect(await screen.findByText("This question needs an answer")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How many jerrycans a week"), "12");
    expect(window.localStorage.getItem("hs-form-draft-walk-agency-borehole")).toContain("12");
    await click("Next");
    expect(await screen.findByText("Question 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Tuesday"));
    await click("Next");
    const review = await screen.findByRole("heading", { level: 1, name: "Review" });
    expect(review.nextElementSibling).toHaveTextContent("Borehole contribution");
    expect(screen.getByRole("button", { name: /1 · How many jerrycans a week/ })).toHaveTextContent("12");
    expect(screen.getByRole("button", { name: /2 · Which days/ })).toHaveTextContent("Tuesday");
    expect(state.sent).toEqual([]);

    await click(/1 · How many jerrycans a week/);
    const field = await screen.findByLabelText("How many jerrycans a week");
    expect(field).toHaveValue(12);
    await userEvent.clear(field);
    await userEvent.type(field, "15");
    await click("Next");
    await click("Next");
    expect(await screen.findByRole("button", { name: /1 · How many jerrycans a week/ })).toHaveTextContent("15");
    expect(state.sent).toEqual([]);
  });

  it("step 3: sends nothing before Submit, then sends the edited answers once, without a member id", async () => {
    const { state, client } = freshClient();
    open(client, "/a/walk-agency/forms/borehole");
    await userEvent.type(await screen.findByLabelText("How many jerrycans a week"), "12");
    await click("Next");
    await userEvent.click(await screen.findByLabelText("Monday"));
    await userEvent.click(screen.getByLabelText("Tuesday"));
    await click("Next");
    await screen.findByRole("heading", { level: 1, name: "Review" });
    expect(state.sent).toEqual([]);
    await click("Submit");
    await waitFor(() => expect(state.sent).toHaveLength(1));
    expect(state.sent[0].formId).toBe("borehole");
    expect(state.sent[0].answers).toEqual([
      { question_id: "q1", value_number: 12 },
      { question_id: "q2", option_ids: ["mon", "tue"] },
    ]);
    expect(JSON.stringify(state.sent)).not.toContain("member_id");
    expect(await screen.findByText("Your answers were sent")).toBeInTheDocument();
    expect(window.localStorage.getItem("hs-form-draft-walk-agency-borehole")).toBeNull();
  });

  it("step 4: opens the thread after a standing form's send, one answer per line", async () => {
    const { client } = freshClient();
    open(client);
    await click(/Ask for a delivery/);
    await userEvent.type(await screen.findByLabelText("Pickup"), "Market gate");
    await click("Next");
    await userEvent.type(await screen.findByLabelText("Destination"), "Siaya hospital");
    await click("Next");
    await click("Submit");
    const sub = await screen.findByText("Your thread · with the agent");
    expect(screen.getByRole("heading", { level: 1, name: "Ask for a delivery" }).nextElementSibling).toBe(sub);
    expect(screen.getByText("Pickup: Market gate")).toBeInTheDocument();
    expect(screen.getByText("Destination: Siaya hospital")).toBeInTheDocument();
    await click("Back to forms");
    expect(await screen.findByRole("button", { name: "Waiting · 2" })).toBeInTheDocument();
  });

  it("step 5: lists what she answered newest first with the date of the last send, and a quiet button opens every form she answered", async () => {
    const { client } = freshClient();
    open(client, "/a/walk-agency/forms/pledge");
    await userEvent.type(await screen.findByLabelText("What will you pledge"), "Two bags of maize");
    await click("Next");
    await click("Next");
    await click("Submit");
    await screen.findByText("Your answers were sent");
    await click("Back to forms");
    await click("Answered · 2");
    const rows = await screen.findAllByRole("button", { name: /Sent \d{4}-\d{2}-\d{2}/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Burial fund pledge"),
      expect.stringContaining("Welcome form"),
    ]);
    expect(rows[0]).toHaveTextContent(`Sent ${dayOf(new Date().toISOString())}`);
    expect(rows[1]).toHaveTextContent("Sent 2026-10-01");
    expect(screen.queryByText("Seed order form")).not.toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();

    await click("Every form you answered");
    expect(await screen.findByText("Seed order form")).toBeInTheDocument();
    expect(screen.getAllByText("Closed")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Seed order form/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Every form you answered" })).not.toBeInTheDocument();
  });

  it("step 6: with nothing waiting, one card says so and its button switches to Answered", async () => {
    const { state, client } = freshClient();
    state.waiting = [];
    open(client);
    expect(await screen.findByText("Nothing is waiting for you")).toBeInTheDocument();
    expect(screen.getByText("New forms from your groups show up here and on Home.")).toBeInTheDocument();
    await click("See what you answered");
    expect(await screen.findByText("Welcome form")).toBeInTheDocument();
    expect(screen.queryByText("Nothing is waiting for you")).not.toBeInTheDocument();
  });
});
