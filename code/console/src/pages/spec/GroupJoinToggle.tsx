import { useState } from "react";
import { joinOpenWord } from "../../data/pages/groups";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { Button } from "../../ui";
import { sendAction, type Outcome } from "./sendAction";

type GroupJoinToggleProps = {
  row: PageRow;
  hubId: string;
  onOutcome: (result: Outcome) => void;
};

export function GroupJoinToggle({ row, hubId, onOutcome }: GroupJoinToggleProps) {
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const isOpen = row.join_mode === joinOpenWord;

  const toggle = async () => {
    setSending(true);
    const result = await sendAction("groups", "joinMode", hubId, {
      id: String(row.id ?? ""),
      group_name: String(row.group ?? ""),
      join_mode: isOpen ? "confirmed" : "open",
    });
    setSending(false);
    onOutcome(result);
  };

  return (
    <Button kind="quiet" disabled={sending} onClick={toggle}>
      {t(isOpen ? "joinRequireApproval" : "joinOpenToAnyone")}
    </Button>
  );
}
