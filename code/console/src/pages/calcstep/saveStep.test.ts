import { describe, expect, it, vi } from "vitest";
import { calculatingFields, postingFields, saveStep, type StepDraft } from "./saveStep";
import { loanPaymentSetup } from "./stepSetup";

const filled: StepDraft = {
  stepId: "work-out",
  function: "fin.pmt@2",
  steps: loanPaymentSetup.steps,
  inputs: [
    { name: "principal", type: "currency", source: { kind: "ledger" } },
    { name: "monthly_rate", type: "number", source: { kind: "fixed", value: "0.01" } },
    { name: "months", type: "number", source: { kind: "step", step: "Apply for a loan", question: "How many months?", type: "number" } },
  ],
  step: { runner: { kind: "agency" }, failure: { kind: "stop" }, resultName: "Monthly payment", rounding: null },
  postStepId: "post",
  posting: { amount: "work-out", debitAccount: "cash", creditAccount: "member-loans", reason: "Loan payment" },
};

const recorder = (drafts: unknown) => vi.fn(async (_hub: string, tool: string) => (tool === "agency_list_drafts" ? drafts : {})) as never;

const writes = (call: ReturnType<typeof recorder>) =>
  (call as unknown as { mock: { calls: [string, string, Record<string, unknown>][] } }).mock.calls.filter((entry) => entry[1] === "agency_update_work_item").map((entry) => entry[2]);

describe("saving a calculating step", () => {
  it("writes the function, the bindings, the result name and the failure choice on the step", () => {
    const fields = calculatingFields(filled);
    expect(fields.work_item_id).toBe("work-out");
    expect(fields.function).toBe("fin.pmt@2");
    expect(fields.result_name).toBe("Monthly payment");
    expect(JSON.parse(String(fields.on_failure))).toEqual({ choice: "stop" });
    expect(JSON.parse(String(fields.bindings))).toEqual([
      { input: "principal", source_type: "ledger_balance" },
      { input: "monthly_rate", source_type: "fixed", value: "0.01" },
      { input: "months", source_type: "answer", step_id: "apply", question: "How many months?" },
    ]);
  });

  it("writes a go to step choice with the step's id and leaves the choice out when it is empty", () => {
    const goto = calculatingFields({ ...filled, step: { ...filled.step, failure: { kind: "goto", stepId: "review" } } });
    expect(JSON.parse(String(goto.on_failure))).toEqual({ choice: "go_to_step", step_id: "review" });
    expect(calculatingFields({ ...filled, step: { ...filled.step, failure: null } })).not.toHaveProperty("on_failure");
  });

  it("writes the posting step with its amount, debit account, credit account and reason", () => {
    expect(postingFields(filled)).toEqual({
      work_item_id: "post",
      amount_step_id: "work-out",
      debit_account: "cash",
      credit_account: "member-loans",
      reason: "Loan payment",
    });
  });

  it("sends both steps into the open draft, calculating step first", async () => {
    const call = recorder({ items: [{ id: "d1" }] });
    await saveStep("h1", filled, call);
    const sent = writes(call);
    expect(sent.map((args) => args.work_item_id)).toEqual(["work-out", "post"]);
    sent.forEach((args) => expect(args.draft_id).toBe("d1"));
  });

  it("sends only the calculating step when the posting step is not complete", async () => {
    const call = recorder({ items: [{ id: "d1" }] });
    await saveStep("h1", { ...filled, posting: { ...filled.posting, reason: "" } }, call);
    expect(writes(call).map((args) => args.work_item_id)).toEqual(["work-out"]);
  });

  it("leaves draft_id out when the agency has no open draft", async () => {
    const call = recorder({ items: [] });
    await saveStep("h1", filled, call);
    expect(writes(call)[0]).not.toHaveProperty("draft_id");
  });
});
