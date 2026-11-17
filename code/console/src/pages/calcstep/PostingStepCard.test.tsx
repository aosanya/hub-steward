import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { PostingStepCard } from "./PostingStepCard";
import type { Posting } from "./postingSentence";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const results = [{ key: "pmt", name: "Monthly payment", step: "Work out the monthly payment" }];
const accounts = [
  { id: "loans", name: "Member loans" },
  { id: "savings", name: "Member savings" },
  { id: "cash", name: "Cash" },
];
const value: Posting = { amount: "pmt", account: "loans", otherSide: "cash", direction: "credit", reason: "Loan payment for the month" };

const show = (props: Partial<{ value: Posting; sample: string; onChange: (value: Posting) => void }> = {}) => {
  const onChange = props.onChange ?? vi.fn();
  render(
    <I18nProvider initial={words}>
      <PostingStepCard title="Post the payment" results={results} accounts={accounts} value={props.value ?? value} sample={props.sample} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
};

describe("the posting step card", () => {
  it("lists only the results of calculating steps as the amount, and nobody types one", () => {
    show();
    const amount = screen.getByRole("combobox", { name: "Amount" });
    expect(within(amount).getAllByRole("option").map((option) => option.textContent)).toEqual(["Monthly payment (from Work out the monthly payment)"]);
    expect(screen.queryByRole("textbox", { name: "Amount" })).toBeNull();
    expect(screen.getByText("The result of a calculating step earlier in this workflow. Nobody types an amount here.")).toBeInTheDocument();
  });

  it("names both accounts, and each can be any account", () => {
    show();
    for (const label of ["Account", "Other side"])
      expect(within(screen.getByRole("combobox", { name: label })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Member loans", "Member savings", "Cash"]);
  });

  it("offers the direction as two sides of the account, never a sign", async () => {
    const onChange = show();
    const group = screen.getByRole("radiogroup");
    const sides = within(group).getAllByRole("radio");
    expect(sides.map((side) => (side as HTMLInputElement).labels?.[0]?.textContent)).toEqual(["Debit Member loans", "Credit Member loans"]);
    expect(within(group).getByRole("radio", { name: "Credit Member loans" })).toBeChecked();
    await userEvent.click(within(group).getByRole("radio", { name: "Debit Member loans" }));
    expect(onChange).toHaveBeenCalledWith({ ...value, direction: "debit" });
  });

  it("changes the reason and the other side", async () => {
    const onChange = show();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Other side" }), "savings");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, otherSide: "savings" });
    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "!");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, reason: "Loan payment for the month!" });
  });

  it("reads the whole posting back as a sentence and a short list", () => {
    show({ sample: "564.88" });
    const card = screen.getByRole("heading", { name: "What it does" }).closest("section") as HTMLElement;
    expect(within(card).getByText(/^Credits Member loans and debits Cash by the Monthly payment\./)).toBeInTheDocument();
    const pairs = Object.fromEntries([...card.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent]));
    expect(pairs).toEqual({ Amount: "564.88 on the sample", "Member loans": "credit", Cash: "debit" });
  });

  it("leaves the read-back empty until the posting is complete", () => {
    show({ value: { ...value, reason: "" } });
    expect(screen.queryByText(/^Credits /)).toBeNull();
    expect(screen.getByText("Choose the amount, both accounts and a reason to read the posting back.")).toBeInTheDocument();
  });
});
