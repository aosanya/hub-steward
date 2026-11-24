import { Fragment, useMemo, type ReactNode } from "react";
import { EntryScreen } from "../entry/EntryScreen";
import { ErrorLine } from "../entry/ErrorLine";
import { GroupPick } from "../entry/GroupPick";
import { NoGroup } from "../entry/NoGroup";
import { useLeave } from "../entry/useLeave";
import { useI18n } from "../i18n";
import { Button, Card, Loading, Row } from "../ui";
import { GroupCtx, type GroupControl } from "./groupContext";
import { useAssumedGroup } from "./useAssumedGroup";

export function GroupGate({ hubId, children }: { hubId: string; children: ReactNode }) {
  const { t } = useI18n();
  const { state, assume, reload } = useAssumedGroup(hubId);
  const leave = useLeave();
  const control = useMemo<GroupControl | null>(
    () => (state.status === "ready" ? { groups: state.groups, assumed: state.assumed, assume } : null),
    [state, assume],
  );

  if (state.status === "loading") return <Loading />;
  if (state.status === "failed")
    return (
      <EntryScreen onSignOut={leave}>
        <Card>
          <ErrorLine>{t("loadFailed")}</ErrorLine>
          <Row>
            <Button kind="quiet" onClick={reload}>
              {t("retry")}
            </Button>
          </Row>
        </Card>
      </EntryScreen>
    );
  if (state.status === "none") return <NoGroup onCheck={reload} onLeave={leave} />;
  if (state.status === "pick") return <GroupPick groups={state.groups} onPick={assume} onLeave={leave} />;
  return (
    <GroupCtx.Provider value={control}>
      <Fragment key={state.assumed.id}>{children}</Fragment>
    </GroupCtx.Provider>
  );
}
