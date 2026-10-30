import { useState } from "react";
import { byName, matching } from "../../data/listView";
import { loadModules, setModuleEnabled, type AgencyModule } from "../../data/pages/agencyModules";
import { useI18n } from "../../i18n";
import { Empty, FilterBar, Note, Stack, StatusLine, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { ModulesTable } from "./ModulesTable";

export function ModulesPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => loadModules(hubId), [hubId]);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const [search, setSearch] = useState("");

  const onSwitch = async (module: AgencyModule, on: boolean) => {
    setBusy(true);
    setRefused("");
    try {
      await setModuleEnabled(hubId, module.id, on);
      reload();
    } catch (error) {
      setRefused((error instanceof Error && error.message) || t("modules.failed"));
    }
    setBusy(false);
  };

  return (
    <>
      <TitleRow title={t("menu.modules")} />
      <div className="content">
        {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
        {state.kind === "ready" ? (
          <Stack>
            <Note>{t("modules.note")}</Note>
            {refused ? <StatusLine text={refused} failed /> : null}
            <FilterBar placeholder={t("modules.search")} chips={[]} search={search} onSearch={setSearch} />
            <ModulesTable modules={byName(matching(state.value, (module) => [module.name, module.description ?? ""], search), (module) => module.name)} busy={busy} onSwitch={onSwitch} />
          </Stack>
        ) : null}
      </div>
    </>
  );
}
