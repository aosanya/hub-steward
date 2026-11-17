import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { postingSentence, type Posting } from "./postingSentence";

const words: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));
const t = (key: string) => words.en[key] ?? key;

const names = { amount: "Monthly payment", accounts: { loans: "Member loans", cash: "Cash", savings: "Member savings" } };

const credit: Posting = { amount: "pmt", account: "loans", otherSide: "cash", direction: "credit", reason: "Loan payment for the month" };

const sentenceOf = (posting: Posting) => postingSentence(posting, names, t);

describe("the posting read back as a sentence", () => {
  it("reads the accepted drawing's example word for word", () => {
    expect(sentenceOf(credit)).toBe(
      "Credits Member loans and debits Cash by the Monthly payment. The reason on the entry reads “Loan payment for the month”. Running this step twice for the same case posts once.",
    );
  });

  it("turns the two sides round for a debit", () => {
    expect(sentenceOf({ ...credit, direction: "debit" })).toBe(
      "Debits Member loans and credits Cash by the Monthly payment. The reason on the entry reads “Loan payment for the month”. Running this step twice for the same case posts once.",
    );
  });

  it("never writes a minus sign", () => {
    expect(sentenceOf(credit)).not.toMatch(/[-−]\s?\d|minus/i);
    expect(sentenceOf({ ...credit, direction: "debit" })).not.toMatch(/[-−]\s?\d|minus/i);
  });

  it("says nothing until the amount, both accounts and the reason are chosen", () => {
    expect(sentenceOf({ ...credit, amount: "" })).toBe("");
    expect(sentenceOf({ ...credit, account: "" })).toBe("");
    expect(sentenceOf({ ...credit, otherSide: "" })).toBe("");
    expect(sentenceOf({ ...credit, reason: "  " })).toBe("");
  });

  it("says nothing when both sides are the same account", () => {
    expect(sentenceOf({ ...credit, otherSide: "loans" })).toBe("");
  });
});
