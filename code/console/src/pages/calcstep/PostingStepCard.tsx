import { useI18n } from "../../i18n";
import type { ReactNode } from "react";
import { Card, Detail, Note, SelectControl, SettingRows, Stack, TextControl } from "../../ui";
import { OptionControl } from "../../ui/fieldControls";
import { postingSentence, type Direction, type Posting } from "./postingSentence";

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
  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const amountOptions = results.map((result) => ({ value: result.key, label: t("calcstep.posting.amountFrom").replace("{name}", result.name).replace("{step}", result.step) }));
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? "";
  const amountName = results.find((result) => result.key === value.amount)?.name ?? "";
  const accountName = nameOf(value.account);
  const otherName = nameOf(value.otherSide);
  const sentence = postingSentence(value, { amount: amountName, accounts: Object.fromEntries(accounts.map((account) => [account.id, account.name])) }, t);
  const sides: { value: Direction; label: string }[] = [
    { value: "debit", label: t("calcstep.posting.debit").replace("{account}", accountName) },
    { value: "credit", label: t("calcstep.posting.credit").replace("{account}", accountName) },
  ];
  const rows = [
    {
      label: t("calcstep.posting.amount"),
      htmlFor: "posting-amount",
      control: (
        <Control>
          <SelectControl id="posting-amount" label={t("calcstep.posting.amount")} value={value.amount} options={amountOptions} onChange={(amount) => set({ amount })} />
          {hint(t("calcstep.posting.amountHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.account"),
      htmlFor: "posting-account",
      control: (
        <Control>
          <SelectControl id="posting-account" label={t("calcstep.posting.account")} value={value.account} options={accountOptions} onChange={(account) => set({ account })} />
          {hint(t("calcstep.posting.accountHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.otherSide"),
      htmlFor: "posting-other-side",
      control: (
        <Control>
          <SelectControl id="posting-other-side" label={t("calcstep.posting.otherSide")} value={value.otherSide} options={accountOptions} onChange={(otherSide) => set({ otherSide })} />
          {hint(t("calcstep.posting.otherSideHint"))}
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.direction"),
      control: (
        <Control>
          <span className="sr" id="posting-direction">
            {t("calcstep.posting.direction")}
          </span>
          <OptionControl
            name="posting-direction"
            labelledBy="posting-direction"
            options={sides}
            off={false}
            multiple={false}
            isOn={(option) => option.value === value.direction}
            onPick={(option) => set({ direction: option.value as Direction })}
          />
        </Control>
      ),
    },
    {
      label: t("calcstep.posting.reason"),
      htmlFor: "posting-reason",
      control: (
        <Control>
          <TextControl id="posting-reason" label={t("calcstep.posting.reason")} value={value.reason} onChange={(reason) => set({ reason })} />
          {hint(t("calcstep.posting.reasonHint"))}
        </Control>
      ),
    },
  ];
  const sideWord = (direction: Direction) => t(direction === "credit" ? "calcstep.posting.sideCredit" : "calcstep.posting.sideDebit");
  const other: Direction = value.direction === "credit" ? "debit" : "credit";
  const pairs: [string, string][] = [];
  if (sentence) {
    if (sample) pairs.push([t("calcstep.posting.amount"), t("calcstep.posting.onSample").replace("{amount}", sample)]);
    pairs.push([accountName, sideWord(value.direction)], [otherName, sideWord(other)]);
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
