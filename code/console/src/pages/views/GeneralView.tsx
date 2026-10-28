import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Empty, TitleRow } from "../../ui";
import { GeneralSheet } from "../spec/generalSheet";
import { useSpecPage } from "../spec/useSpecPage";

export function GeneralView() {
  const { hub } = useConsole();
  return <GeneralPage key={hub.id} hubId={hub.id} />;
}

function GeneralPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useSpecPage(hubId, "general");
  const row = state.kind === "ready" ? state.rows?.[0] : undefined;

  if (row) return <GeneralSheet key={JSON.stringify([row.joining, row.default_language])} hubId={hubId} row={row} reload={reload} />;

  return (
    <>
      <TitleRow title={t("menu.general")} />
      <div className="content">
        {state.kind === "ready" ? <Empty text={state.rows === null ? t("loadFailed") : t("noRows")} failed={state.rows === null} /> : null}
      </div>
    </>
  );
}
