import { useState } from "react";
import type { Control } from "../../data/pages/controls";
import { useI18n } from "../../i18n";
import { byName, matching } from "../../data/listView";
import { Card, Detail, Empty, FilterBar, Stack, TextLink } from "../../ui";
import { controlsHref } from "./controlsLinks";

const strengthWords = ["enforced", "tested", "advisory"];
const severityWords = ["high", "medium", "low"];

function ControlCard({ hubId, control }: { hubId: string; control: Control }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const word = (group: string[], value: string) => (group.includes(value) ? t("controls." + value) : value);
  const pairs: [string, string][] = [
    [t("controls.strength"), control.strength ? word(strengthWords, control.strength) : ""],
    [t("controls.action"), control.action],
    [t("controls.onBreach"), control.onBreach],
    [t("controls.severity"), control.severity ? word(severityWords, control.severity) : ""],
    [t("controls.attachedTo"), control.attachedTo],
  ];
  return (
    <Card
      title={[control.code, control.text].filter(Boolean).join(" · ")}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={controlsHref(hubId, { control: control.id })} size="sm">
          {t("controls.edit")}
        </TextLink>
      }
    >
      <Detail pairs={pairs.filter(([, value]) => value)} />
    </Card>
  );
}

export function ControlsList({ hubId, controls }: { hubId: string; controls: Control[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const shown = byName(
    matching(controls, (control) => [control.code, control.text, control.action, control.attachedTo], search),
    (control) => control.text,
  );
  return (
    <Stack gap={20}>
      <FilterBar placeholder={t("controls.search")} chips={[]} search={search} onSearch={setSearch} />
      {shown.length === 0 ? <Empty text={t("noRows")} /> : shown.map((control) => <ControlCard key={control.id} hubId={hubId} control={control} />)}
    </Stack>
  );
}
