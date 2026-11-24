import { useState } from "react";
import { setGroupDisabled } from "../../data/disabledGroups";
import { useI18n } from "../../i18n";
import { Chip, Toggle, useNotice } from "../../ui";

export function DisabledChip({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  return disabled ? <Chip kind="warn">{t("groups.disabled")}</Chip> : <Chip kind="use">{t("groups.enabled")}</Chip>;
}

type GroupDisabledToggleProps = { hubId: string; groupId: string; disabled: boolean; onChanged: () => void };

export function GroupDisabledToggle({ hubId, groupId, disabled, onChanged }: GroupDisabledToggleProps) {
  const { t } = useI18n();
  const { show } = useNotice();
  const [busy, setBusy] = useState(false);

  const change = async (enabled: boolean) => {
    setBusy(true);
    const ok = await setGroupDisabled(hubId, groupId, !enabled).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) onChanged();
    else show(t("groups.disableRefused"), "bad");
  };

  return <Toggle label={t("groups.enabledSwitch")} on={!disabled} disabled={busy} onChange={(enabled) => void change(enabled)} />;
}
