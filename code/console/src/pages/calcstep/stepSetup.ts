import type { Account, CalcResult } from "./PostingStepCard";
import type { StepRef } from "./failureChoice";
import type { Posting } from "./postingSentence";
import type { InputRow } from "./sourceFlags";
import type { RoleRef, StepCardValue } from "./StepCard";
import type { SampleClient } from "./sampleRun";

export type StepSetup = {
  inputs: InputRow[];
  steps: StepRef[];
  roles: RoleRef[];
  accounts: Account[];
  results: CalcResult[];
  step: StepCardValue;
  posting: Posting;
  postStepId: string;
  postTitle: string;
  client: SampleClient;
};

const bareInputs: InputRow[] = [
  { name: "principal", type: "currency", source: null },
  { name: "monthly_rate", type: "number", source: null },
  { name: "months", type: "number", source: null },
];

const answerFor = (values: { name: string; text: string }[]) => {
  const missing = values.filter((value) => value.text.trim() === "");
  if (missing.length > 0) {
    return {
      problems: missing.map((value) => ({
        input: value.name,
        item: null,
        given: false,
        value: null,
        rule: "required",
        sentence: `${value.name} was not given.`,
        code: "missing",
        check: null,
      })),
    };
  }
  return { worked: { label: "Monthly payment", value: "564.88", function: "fin.pmt@2", rounding: "half up" } };
};

export const loanPaymentSetup: StepSetup = {
  inputs: bareInputs,
  steps: [
    { id: "apply", name: "Apply for a loan" },
    { id: "work-out", name: "Work out the monthly payment" },
    { id: "review", name: "Loan officer reviews" },
    { id: "post", name: "Post the payment" },
  ],
  roles: [
    { id: "officer", name: "Loan officer" },
    { id: "treasurer", name: "Group treasurer" },
  ],
  accounts: [
    { id: "member-loans", name: "Member loans" },
    { id: "cash", name: "Cash" },
  ],
  results: [{ key: "work-out", name: "Monthly payment", step: "Work out the monthly payment" }],
  step: { runner: { kind: "agency" }, failure: null, resultName: "Monthly payment", rounding: null },
  posting: { amount: "", account: "", otherSide: "", direction: "debit", reason: "" },
  postStepId: "post",
  postTitle: "Post the payment",
  client: { run: async (values) => answerFor(values) },
};
