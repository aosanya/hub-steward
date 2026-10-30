import { useState } from "react";
import { holdOf, type AgencyModule } from "../../data/pages/agencyModules";
import { useI18n } from "../../i18n";
import { Card, Chip, Detail, Empty, Stack, Toggle } from "../../ui";

type ModulesTableProps = { modules: AgencyModule[]; busy: boolean; onSwitch: (module: AgencyModule, on: boolean) => void };

const nameIdOf = (module: AgencyModule) => "module-name-" + module.id;

function ModuleCard({ module, busy, onSwitch }: { module: AgencyModule; busy: boolean; onSwitch: (module: AgencyModule, on: boolean) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hold = holdOf(module);
  const status =
    hold === "locked" ? (
      <Chip kind="mute">{t("modules.alwaysOn")}</Chip>
    ) : hold === "steps" ? (
      <Chip kind="mute">{t("modules.neededBySteps")}</Chip>
    ) : hold === "required" ? (
      <Chip kind="mute">{t("modules.neededByModule")}</Chip>
    ) : module.enabled ? (
      <Chip kind="ok">{t("ui.on")}</Chip>
    ) : (
      <Chip kind="mute">{t("ui.off")}</Chip>
    );
  return (
    <Card
      title={<span id={nameIdOf(module)}>{module.name}</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <>
          {status}
          <Toggle label="" labelledBy={nameIdOf(module)} on={module.enabled} disabled={busy || hold !== "free"} onChange={(on) => onSwitch(module, on)} />
        </>
      }
    >
      <Detail pairs={module.description ? [[t("field.description"), module.description]] : []} />
    </Card>
  );
}

export function ModulesTable({ modules, busy, onSwitch }: ModulesTableProps) {
  const { t } = useI18n();
  if (modules.length === 0) return <Empty text={t("noRows")} />;
  return (
    <Stack gap={20}>
      {modules.map((module) => (
        <ModuleCard key={module.id} module={module} busy={busy} onSwitch={onSwitch} />
      ))}
    </Stack>
  );
}
