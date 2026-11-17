export type Posting = { amount: string; debitAccount: string; creditAccount: string; reason: string };

export type PostingNames = { amount: string; accounts: Record<string, string> };

export type Say = (key: string) => string;

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);

export function postingSentence(posting: Posting, names: PostingNames, t: Say): string {
  const debit = names.accounts[posting.debitAccount];
  const credit = names.accounts[posting.creditAccount];
  const complete = posting.amount && names.amount && debit && credit && posting.debitAccount !== posting.creditAccount && posting.reason.trim();
  if (!complete) return "";
  const sides = fill(t("calcstep.posting.sentence.sides"), { debit, credit, amount: names.amount });
  const reason = fill(t("calcstep.posting.sentence.reason"), { reason: posting.reason.trim() });
  return [sides, reason, t("calcstep.posting.sentence.once")].join(" ");
}
