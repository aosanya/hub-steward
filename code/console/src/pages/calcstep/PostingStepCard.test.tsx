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
const value: Posting = { amount: "pmt", debitAccount: "cash", creditAccount: "loans", reason: "Loan payment for the month" };

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
  it("marks all four of its labels as required, as the drawing does", () => {
    show();
    const labels = Array.from(document.querySelectorAll(".setting-label"));
    expect(labels.map((label) => label.textContent)).toEqual(["Amount*", "Debit account*", "Credit account*", "Reason*"]);
    labels.forEach((label) => expect(label.querySelector(".req")).toHaveAttribute("aria-hidden", "true"));
  });

  it("lists only the results of calculating steps as the amount, and nobody types one", () => {
    show();
    const amount = screen.getByRole("combobox", { name: "Amount" });
    expect(within(amount).getAllByRole("option").map((option) => option.textContent)).toEqual(["Monthly payment (from Work out the monthly payment)"]);
    expect(screen.queryByRole("textbox", { name: "Amount" })).toBeNull();
    expect(screen.getByText("The result of a calculating step earlier in this workflow. Nobody types an amount here.")).toBeInTheDocument();
  });

  it("names a debit account and a credit account, and each can be any account", () => {
    show();
    for (const label of ["Debit account", "Credit account"])
      expect(within(screen.getByRole("combobox", { name: label })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Member loans", "Member savings", "Cash"]);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText("Direction")).toBeNull();
  });

  it("shows the account each side starts with", () => {
    show();
    expect(screen.getByRole("combobox", { name: "Debit account" })).toHaveValue("cash");
    expect(screen.getByRole("combobox", { name: "Credit account" })).toHaveValue("loans");
  });

  it("changes the debit account, the credit account and the reason", async () => {
    const onChange = show();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Debit account" }), "savings");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, debitAccount: "savings" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Credit account" }), "cash");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, creditAccount: "cash" });
    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "!");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, reason: "Loan payment for the month!" });
  });

  it("asks for a choice instead of showing the first option when nothing is chosen", () => {
    show({ value: { amount: "", debitAccount: "", creditAccount: "", reason: "" } });
    for (const label of ["Amount", "Debit account", "Credit account"]) {
      const picker = screen.getByRole("combobox", { name: label });
      expect(picker).toHaveValue("");
      expect(within(picker).getAllByRole("option")[0]).toHaveTextContent("Choose one");
    }
  });

  it("offers no empty choice once something is chosen", () => {
    show();
    expect(within(screen.getByRole("combobox", { name: "Debit account" })).queryByRole("option", { name: "Choose one" })).toBeNull();
  });

  it("reads the whole posting back as a sentence and a short list", () => {
    show({ sample: "564.88" });
    const card = screen.getByRole("heading", { name: "What it does" }).closest("section") as HTMLElement;
    expect(within(card).getByText(/^Debits Cash and credits Member loans by the Monthly payment\./)).toBeInTheDocument();
    const pairs = Object.fromEntries([...card.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent]));
    expect(pairs).toEqual({ Amount: "564.88 on the sample", "Debit account": "Cash", "Credit account": "Member loans" });
  });

  it("leaves the read-back empty until the posting is complete", () => {
    show({ value: { ...value, reason: "" } });
    expect(screen.queryByText(/^Debits /)).toBeNull();
    expect(screen.getByText("Choose the amount, both accounts and a reason to read the posting back.")).toBeInTheDocument();
  });
});
