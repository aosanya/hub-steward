export type Direction = "debit" | "credit";

export type Posting = { amount: string; account: string; otherSide: string; direction: Direction; reason: string };

export type PostingNames = { amount: string; accounts: Record<string, string> };

export type Say = (key: string) => string;

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);

export function postingSentence(posting: Posting, names: PostingNames, t: Say): string {
  const account = names.accounts[posting.account];
  const otherSide = names.accounts[posting.otherSide];
  const complete = posting.amount && names.amount && account && otherSide && posting.account !== posting.otherSide && posting.reason.trim();
  if (!complete) return "";
  const sides = fill(t(posting.direction === "credit" ? "calcstep.posting.sentence.credit" : "calcstep.posting.sentence.debit"), {
    account,
    other: otherSide,
    amount: names.amount,
  });
  const reason = fill(t("calcstep.posting.sentence.reason"), { reason: posting.reason.trim() });
  return [sides, reason, t("calcstep.posting.sentence.once")].join(" ");
}
