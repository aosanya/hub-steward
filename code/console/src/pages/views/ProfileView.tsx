import { useLocation } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Empty, TitleRow } from "../../ui";
import { ProfileSheet } from "../spec/profileSheet";
import { useSpecPage } from "../spec/useSpecPage";

export function ProfileView() {
  const { hub } = useConsole();
  return <ProfilePage key={hub.id} hubId={hub.id} />;
}

function ProfilePage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useSpecPage(hubId, "profile");
  const { key: visit } = useLocation();
  const row = state.kind === "ready" ? state.rows?.[0] : undefined;

  if (row) return <ProfileSheet key={JSON.stringify([row.name, row.purpose, visit])} hubId={hubId} row={row} reload={reload} />;

  return (
    <>
      <TitleRow title={t("menu.profile")} />
      <div className="content">
        {state.kind === "ready" ? <Empty text={state.rows === null ? t("loadFailed") : t("noRows")} failed={state.rows === null} /> : null}
      </div>
    </>
  );
}
