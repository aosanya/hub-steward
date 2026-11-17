import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { postingSentence, type Posting } from "./postingSentence";

const words: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));
const t = (key: string) => words.en[key] ?? key;

const names = { amount: "Monthly payment", accounts: { loans: "Member loans", cash: "Cash", savings: "Member savings" } };

const posting: Posting = { amount: "pmt", debitAccount: "cash", creditAccount: "loans", reason: "Loan payment for the month" };

const sentenceOf = (value: Posting) => postingSentence(value, names, t);

describe("the posting read back as a sentence", () => {
  it("reads the debit account first and the credit account second", () => {
    expect(sentenceOf(posting)).toBe(
      "Debits Cash and credits Member loans by the Monthly payment. The reason on the entry reads “Loan payment for the month”. Running this step twice for the same case posts once.",
    );
  });

  it("follows the accounts chosen, not their order in the list", () => {
    expect(sentenceOf({ ...posting, debitAccount: "loans", creditAccount: "savings" })).toMatch(/^Debits Member loans and credits Member savings by the Monthly payment\./);
  });

  it("never writes a minus sign", () => {
    expect(sentenceOf(posting)).not.toMatch(/[-−]\s?\d|minus/i);
  });

  it("says nothing until the amount, both accounts and the reason are chosen", () => {
    expect(sentenceOf({ ...posting, amount: "" })).toBe("");
    expect(sentenceOf({ ...posting, debitAccount: "" })).toBe("");
    expect(sentenceOf({ ...posting, creditAccount: "" })).toBe("");
    expect(sentenceOf({ ...posting, reason: "  " })).toBe("");
  });

  it("says nothing when both sides are the same account", () => {
    expect(sentenceOf({ ...posting, creditAccount: "cash" })).toBe("");
  });
});
