import { useI18n } from "../../i18n";
import type { ReactNode } from "react";
import { Card, Detail, Note, SelectControl, SettingRows, Stack, TextControl } from "../../ui";
import { postingSentence, type Posting } from "./postingSentence";

export type CalcResult = { key: string; name: string; step: string };

export type Account = { id: string; name: string };

export type PostingStepCardProps = {
  title: string;
  results: CalcResult[];
  accounts: Account[];
  value: Posting;
  onChange: (value: Posting) => void;
  sample?: string;
};

const hint = (text: string) => <span className="hint">{text}</span>;

const Control = ({ children }: { children: ReactNode }) => (
  <div className="stack" style={{ "--stack-gap": "8px", alignItems: "stretch" } as Record<string, string>}>
    {children}
  </div>
);

export function PostingStepCard({ title, results, accounts, value, onChange, sample }: PostingStepCardProps) {
  const { t } = useI18n();
  const set = (change: Partial<Posting>) => onChange({ ...value, ...change });
  const askWhenEmpty = (chosen: string, listed: { value: string; label: string }[]) => (chosen ? listed : [{ value: "", label: t("calcstep.posting.chooseOne") }, ...listed]);
  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const amountOptions = results.map((result) => ({ value: result.key, label: t("calcstep.posting.amountFrom").replace("{name}", result.name).replace("{step}", result.step) }));
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? "";
  const amountName = results.find((result) => result.key === value.amount)?.name ?? "";
  const debitName = nameOf(value.debitAccount);
  const creditName = nameOf(value.creditAccount);
  const sentence = postingSentence(value, { amount: amountName, accounts: Object.fromEntries(accounts.map((account) => [account.id, account.name])) }, t);
  const rows = [
    {
      label: t("calcstep.posting.amount"),
      required: true,
      htmlFor: "posting-amount",
      control: (
        <Control>
          <SelectControl id="posting-amount" label={t("calcstep.posting.amount")} value={value.amount} options={askWhenEmpty(value.amount, amountOptions)} onChange={(amount) => set({ amount })} />
          {hint(t("calcstep.posting.amountHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.debitAccount"),
      required: true,
      htmlFor: "posting-debit-account",
      control: (
        <Control>
          <SelectControl id="posting-debit-account" label={t("calcstep.posting.debitAccount")} value={value.debitAccount} options={askWhenEmpty(value.debitAccount, accountOptions)} onChange={(debitAccount) => set({ debitAccount })} />
          {hint(t("calcstep.posting.debitAccountHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.creditAccount"),
      required: true,
      htmlFor: "posting-credit-account",
      control: (
        <Control>
          <SelectControl id="posting-credit-account" label={t("calcstep.posting.creditAccount")} value={value.creditAccount} options={askWhenEmpty(value.creditAccount, accountOptions)} onChange={(creditAccount) => set({ creditAccount })} />
          {hint(t("calcstep.posting.creditAccountHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.reason"),
      required: true,
      htmlFor: "posting-reason",
      control: (
        <Control>
          <TextControl id="posting-reason" label={t("calcstep.posting.reason")} value={value.reason} onChange={(reason) => set({ reason })} />
          {hint(t("calcstep.posting.reasonHint"))}
        </Control>
      ),
    },
  ];
  const pairs: [string, string][] = [];
  if (sentence) {
    if (sample) pairs.push([t("calcstep.posting.amount"), t("calcstep.posting.onSample").replace("{amount}", sample)]);
    pairs.push([t("calcstep.posting.debitAccount"), debitName], [t("calcstep.posting.creditAccount"), creditName]);
  }
  return (
    <Stack>
      <Card title={title} actions={<span className="tag mute">{t("calcstep.posting.tag")}</span>}>
        <SettingRows rows={rows} />
      </Card>
      <Card title={t("calcstep.posting.readBack")}>
        {sentence ? <Note>{sentence}</Note> : <Note>{t("calcstep.posting.incomplete")}</Note>}
        {pairs.length > 0 ? <Detail pairs={pairs} /> : null}
      </Card>
    </Stack>
  );
}
