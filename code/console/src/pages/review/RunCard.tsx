import { useI18n } from "../../i18n";
import { Button, Empty, StatusLine } from "../../ui";

type Props = { onRun: () => void; busy: boolean; refusal: string; text?: string; label?: string };

export function RunCard({ onRun, busy, refusal, text, label }: Props) {
  const { t } = useI18n();
  return (
    <Empty
      text={text ?? t("review.empty")}
      action={
        <>
          <Button onClick={onRun} disabled={busy}>
            {label ?? t("review.run")}
          </Button>
          {refusal ? <StatusLine text={refusal} failed /> : null}
        </>
      }
    />
  );
}
