import { useState } from "react";
import type { DeclineChoice } from "../../data/pages/joinDecisions";
import { useI18n } from "../../i18n";
import { Button, Card, Row, Stack, TextareaControl } from "../../ui";

type UsersDeclineProps = {
  name: string;
  group: string;
  busy: boolean;
  onConfirm: (choice: DeclineChoice) => void;
  onCancel: () => void;
};

export function UsersDecline({ name, group, busy, onConfirm, onCancel }: UsersDeclineProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <Card tight>
      <Stack gap={12}>
        <span>{t("users.declineAsk").replace("{name}", name).replace("{group}", group)}</span>
        <TextareaControl value={reason} onChange={setReason} label={t("users.declineReason")} placeholder={t("users.declineReason")} disabled={busy} />
        <Row>
          <Button kind="danger" size="sm" disabled={busy} onClick={() => onConfirm({ silent: false, reason })}>
            {t("decline")}
          </Button>
          <Button kind="quiet" size="sm" disabled={busy} onClick={() => onConfirm({ silent: true, reason: "" })}>
            {t("users.declineQuietly")}
          </Button>
          <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
