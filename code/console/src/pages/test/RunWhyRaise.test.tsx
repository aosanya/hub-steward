import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { TestView } from "../views/TestView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const step = (n: number, more: Record<string, unknown> = {}) => ({
  step_id: "st" + n,
  step: "Ask " + n,
  actor: "Suppliers' agent",
  played_by: "",
  did: "Did " + n,
  recorded: "Recorded " + n,
  rules: [],
  tokens: 1000 * n,
  ...more,
});

const failing = step(4, {
  did: "Messaged the Supplier 2 again",
  failed: true,
  expected: "One message to each ticked shop",
  found: "A second ask to the Supplier 2",
  rules: [{ code: "RU-7", held: false }],
});

const run = (result: string, steps: unknown[], more: Record<string, unknown> = {}) => ({
  id: "r1",
  scenario_id: "s1",
  draft_version: "ver-1",
  result,
  stop_reason: "",
  tokens: 3900,
  token_budget: 0,
  started_at: "2026-10-28T10:05:00Z",
  finished_at: "2026-10-28T10:06:00Z",
  steps,
  ...more,
});

const account = {
  id: "acc-1",
  is_default: true,
  tokens_per_call: 4000,
  tokens_per_day: null,
  tokens_per_week: 900000,
  tokens_per_month: null,
  requests_per_minute: 30,
  requests_per_day: null,
  requests_per_week: null,
  tokens_per_test: 30000,
  scenarios_at_once: 2,
};

const hub = (read: unknown, more: Record<string, unknown> = {}) => ({
  agency_get_test_run: read,
  agency_get_scenario: { id: "s1", name: "Find it", workflow_id: "w9" },
  agency_list_test_runs: { items: [] },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_rules: {
    items: [
      { code: "RU-2", text: "Nobody orders twice." },
      { code: "RU-7", text: "The agents ask only the shop a person ticked, once each." },
    ],
  },
  ai_get_default_account: account,
  ai_get_account: account,
  ai_chat_account: { message: { content: "The Ask step runs again when a shop has not answered." } },
  ...more,
});

const show = (replies: Record<string, unknown>) => {
  answering(replies);
  return renderView("test", TestView, "?run=r1");
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("Why did this fail? on a failed run", () => {
  it("puts the failing step, the rule, what was expected and found, and the likely cause in the content area, linked to the rule and the workflow", async () => {
    show(hub(run("failed", [step(1), failing])));

    await userEvent.click(await screen.findByRole("button", { name: "Why did this fail?" }));

    const answer = await screen.findByRole("region", { name: "Answer from the chat" });
    expect(await within(answer).findByText("2 · Ask 4: Messaged the Supplier 2 again")).toBeInTheDocument();
    expect(within(answer).getByText("RU-7: The agents ask only the shop a person ticked, once each.")).toBeInTheDocument();
    expect(within(answer).getByText("One message to each ticked shop")).toBeInTheDocument();
    expect(within(answer).getByText("A second ask to the Supplier 2")).toBeInTheDocument();
    expect(within(answer).getByText("The Ask step runs again when a shop has not answered.")).toBeInTheDocument();
    expect(within(answer).getByRole("link", { name: "Open the rule" })).toHaveAttribute("href", "/h/h1/roles");
    expect(within(answer).getByRole("link", { name: "Open the workflow" })).toHaveAttribute("href", "/h/h1/workflows?open=w9");
    expect(callsTo("agency_list_rules")).toEqual([{ draft_id: "d1" }]);
  });

  it("leaves the likely cause out when no model answers, and the rest still shows", async () => {
    show(hub(run("failed", [failing]), { ai_get_default_account: new Error("ai_get_default_account: mark one under Models") }));

    await userEvent.click(await screen.findByRole("button", { name: "Why did this fail?" }));

    const answer = await screen.findByRole("region", { name: "Answer from the chat" });
    expect(await within(answer).findByText("One message to each ticked shop")).toBeInTheDocument();
    expect(within(answer).queryByText("Likely cause")).not.toBeInTheDocument();
  });

  it("clears back to the run", async () => {
    show(hub(run("failed", [failing])));
    await userEvent.click(await screen.findByRole("button", { name: "Why did this fail?" }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(await screen.findByText("What transpired")).toBeInTheDocument();
  });
});

describe("a run that reached its budget", () => {
  const stopped = () =>
    run("stopped", [step(1), step(2)], { stop_reason: "Budget reached", tokens: 30000, token_budget: 30000 });

  it("is Stopped with Budget reached, shows the tokens against the budget and offers both buttons", async () => {
    show(hub(stopped()));

    expect(await screen.findByText("Budget reached")).toBeInTheDocument();
    expect(screen.getByText("30,000 of 30,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run this scenario again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raise the tokens per test" })).toBeInTheDocument();
  });

  it("offers neither on a run the designer stopped", async () => {
    show(hub(run("stopped", [step(1)], { stop_reason: "Stopped by the designer" })));
    await screen.findByText("Stopped by the designer");
    expect(screen.queryByRole("button", { name: "Raise the tokens per test" })).not.toBeInTheDocument();
  });

  it("puts the limits form in the content area filled from the default account, and changes only Tokens per test on approval", async () => {
    show(hub(stopped(), { ai_set_limits: account }));

    await userEvent.click(await screen.findByRole("button", { name: "Raise the tokens per test" }));

    const form = await screen.findByRole("region", { name: "Answer from the chat" });
    expect(await within(form).findByText("Now 30,000. Every scenario's run stops there.")).toBeInTheDocument();
    const field = within(form).getByRole("textbox", { name: "Tokens per test" });
    expect(field).toHaveValue("45,000");
    expect(callsTo("ai_set_limits")).toEqual([]);

    await userEvent.clear(field);
    await userEvent.type(field, "45000");
    await userEvent.click(within(form).getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Tokens per test is 45,000. It applies to the next run.")).toBeInTheDocument();
    expect(callsTo("ai_set_limits")).toEqual([
      {
        accountID: "acc-1",
        tokens_per_call: 4000,
        tokens_per_day: null,
        tokens_per_week: 900000,
        tokens_per_month: null,
        requests_per_minute: 30,
        requests_per_day: null,
        requests_per_week: null,
        tokens_per_test: 45000,
        scenarios_at_once: 2,
      },
    ]);
  });

  it("keeps the Stopped run as it was and offers Run this scenario again after the raise", async () => {
    show(hub(stopped(), { ai_set_limits: account, agency_run_scenario: { id: "r9", scenario_id: "s1", result: "running" } }));
    await userEvent.click(await screen.findByRole("button", { name: "Raise the tokens per test" }));
    await userEvent.click(await within(await screen.findByRole("region", { name: "Answer from the chat" })).findByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Budget reached")).toBeInTheDocument();
    expect(screen.getByText("30,000 of 30,000")).toBeInTheDocument();
    expect(callsTo("agency_run_scenario")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Run this scenario again" }));
    expect(callsTo("agency_run_scenario")).toEqual([{ scenario_id: "s1" }]);
  });

  it("shows the refusal and records nothing when the limit is refused", async () => {
    show(hub(stopped(), { ai_set_limits: new Error("ai_set_limits: a limit cannot be below zero") }));
    await userEvent.click(await screen.findByRole("button", { name: "Raise the tokens per test" }));
    await userEvent.click(await within(await screen.findByRole("region", { name: "Answer from the chat" })).findByRole("button", { name: "Approve" }));

    expect(await screen.findByText("a limit cannot be below zero")).toHaveClass("error");
    expect(screen.queryByText(/It applies to the next run/)).not.toBeInTheDocument();
  });
});
