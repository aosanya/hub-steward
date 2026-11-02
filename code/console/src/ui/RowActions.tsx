import { useI18n } from "../i18n";
import { Button } from "./Button";
import type { ButtonProps } from "./props";
import { EnhanceTool, RowTools } from "./RowTools";

export type RowState = "open" | "applied" | "dismissed";

type RowActionsProps = {
  question: (text: string) => string;
  background: () => Promise<string>;
  hasTool: boolean;
  enhance: { message: string; shown: string; onChanged?: () => void };
  state?: RowState;
  busy?: "applying" | "settling";
  onApply: () => void;
  onDismiss: () => void;
  onUndo?: () => void;
  onDetails?: () => void;
  onComment?: () => void;
  commenting?: boolean;
};

type VerbProps = ButtonProps & { spinning?: boolean };

function Verb({ spinning, children, ...rest }: VerbProps) {
  return (
    <Button kind="quiet" size="xs" className="row-tool" aria-busy={spinning} {...rest}>
      {spinning ? <span className="tool-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function RowActions({
  question,
  background,
  hasTool,
  enhance,
  state = "open",
  busy,
  onApply,
  onDismiss,
  onUndo,
  onDetails,
  onComment,
  commenting,
}: RowActionsProps) {
  const { t } = useI18n();
  const working = busy !== undefined;
  const change = hasTool ? (
    <Verb disabled={working} spinning={busy === "applying"} onClick={onApply}>
      {t("suggest.apply")}
    </Verb>
  ) : (
    <EnhanceTool
      message={enhance.message}
      shown={enhance.shown}
      background={background}
      onChanged={enhance.onChanged}
    />
  );
  const settle =
    state === "dismissed" ? (
      onUndo ? (
        <Verb disabled={working} spinning={busy === "settling"} onClick={onUndo}>
          {t("review.undo")}
        </Verb>
      ) : null
    ) : state === "applied" ? null : (
      <Verb disabled={working} spinning={busy === "settling"} onClick={onDismiss}>
        {t("suggest.dismiss")}
      </Verb>
    );

  return (
    <RowTools asking={state !== "dismissed"} question={question} background={background}>
      {state === "open" ? change : null}
      {onComment ? (
        <Verb aria-expanded={commenting} onClick={onComment}>
          {t("review.comment")}
        </Verb>
      ) : null}
      {onDetails ? <Verb onClick={onDetails}>{t("suggest.details")}</Verb> : null}
      {settle}
    </RowTools>
  );
}
