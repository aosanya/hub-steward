import { Navigate, useParams } from "react-router-dom";
import { hubPath } from "../../api";
import { listAccounts } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Chip, Stack, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { accountTitleOf } from "./accountMap";
import { ModelEdit } from "./ModelEdit";
import { ModelMissing } from "./ModelMissing";
import { ModelTabBody } from "./ModelTabBody";
import { ModelTabs, isStaff, tabIn, type ModelTab } from "./ModelTabs";
import "./models.css";

function OneModel({ accountId, current }: { accountId: string; current: ModelTab }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state: listed, reload } = useLoaded(() => listAccounts(hub.id), [hub.id]);
  const account = listed.kind === "ready" ? listed.value.find((candidate) => candidate.id === accountId) : undefined;
  const unknown = listed.kind === "ready" && !account;

  const body =
    listed.kind === "failed" ? (
      <ModelMissing />
    ) : current === "key" ? (
      <ModelEdit accountId={accountId} onSaved={reload} />
    ) : (
      <ModelTabBody accountId={accountId} tab={current} />
    );

  return (
    <>
      <TitleRow
        title={account ? accountTitleOf(t, account) : t("models.title")}
        actions={isStaff(hub.role) ? <Chip kind="mute">{t("limits.staffSeat")}</Chip> : undefined}
      />
      <div className="content">
        {unknown ? (
          <ModelMissing />
        ) : (
          <Stack gap={20}>
            <ModelTabs accountId={accountId} current={current} />
            {body}
          </Stack>
        )}
      </div>
    </>
  );
}

export function ModelPage() {
  const { hub } = useConsole();
  const params = useParams();
  const accountId = params.accountId ?? "";
  const current = tabIn(hub.role, params.tab);

  if (current !== params.tab) return <Navigate to={hubPath(hub.id, "models", accountId, current)} replace />;
  return <OneModel key={hub.id + "/" + accountId} accountId={accountId} current={current} />;
}
