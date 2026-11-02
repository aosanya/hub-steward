import { useEffect, useState } from "react";
import { currentBudget, raiseBudget, suggestedBudget } from "../../data/testBudget";
import { refusalOf } from "../../data/testRun";
import { useI18n } from "../../i18n";
import { Empty, FormCard, FromChat } from "../../ui";

type Props = { hubId: string; budget: number; onRaised: (value: number) => void; onClear: () => void };

const digitsOf = (typed: string): number => Number(typed.replace(/\D/g, ""));

export function RaiseTokens({ hubId, budget, onRaised, onClear }: Props) {
  const { t, lang } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentBudget(hubId).then(setNow, () => setNow(budget));
  }, [hubId]);

  const held = now === null ? budget : now || budget;
  const approve = (values: Record<string, string | boolean>) => {
    const value = digitsOf(String(values.tokens));
    setBusy(true);
    setRefusal("");
    raiseBudget(hubId, value)
      .then(() => onRaised(value))
      .catch((error) => setRefusal(refusalOf(error) || t("test.raiseFailed")))
      .finally(() => setBusy(false));
  };

  return (
    <FromChat prompt={t("test.raiseTokens")} onClear={onClear}>
      {now === null ? null : (
        <>
          {refusal ? (
            <Empty failed text={refusal} />
          ) : null}
          <FormCard
            key={held}
            title={t("test.tokensPerTest")}
            fields={[
              {
                name: "tokens",
                label: t("test.tokensPerTest"),
                value: suggestedBudget(held).toLocaleString(lang),
                hint: t("test.tokensNow").replace("{n}", held.toLocaleString(lang)),
              },
            ]}
            submit={t("approve")}
            onSubmit={busy ? undefined : approve}
            onCancel={onClear}
          />
        </>
      )}
    </FromChat>
  );
}
