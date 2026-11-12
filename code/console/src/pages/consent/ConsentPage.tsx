import { hubPath } from "../../api";
import { loadConsentVersions, publishedDay, type ConsentVersion } from "../../data/consent";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { Cell, Chip, DataTable, Empty, TitleRow } from "../../ui";

function VersionStatus({ version }: { version: ConsentVersion }) {
  const { t } = useI18n();
  return version.inForce ? <Chip kind="ok">{t("consent.inForce")}</Chip> : <span className="soft">{t("consent.replaced")}</span>;
}

export function ConsentPage() {
  const { t, lang } = useI18n();
  const { hub } = useConsole();
  const { state } = useLoaded(() => loadConsentVersions(hub.id), [hub.id]);

  return (
    <>
      <TitleRow title={t("menu.consent")} primary={t("consent.newVersion")} primaryTo={hubPath(hub.id, "consent", "new")} />
      <div className="content">
        {state.kind === "failed" ? <Empty failed text={t("loadFailed")} /> : null}
        {state.kind === "ready" ? (
          <DataTable
            columns={[t("consent.colVersion"), t("consent.colPublished"), t("consent.colStatus")]}
            empty={t("consent.none")}
            rows={state.value.map((version) => ({
              key: version.id,
              cells: [
                <Cell text={t("consent.version").replace("{n}", version.number)} />,
                publishedDay(version.publishedAt, lang),
                <VersionStatus version={version} />,
              ],
            }))}
          />
        ) : null}
      </div>
    </>
  );
}
