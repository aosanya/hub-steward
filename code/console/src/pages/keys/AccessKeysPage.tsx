import { listAccessKeys, revokeAccessKey, type AccessKey } from "../../data/accessKeys";
import { publishedDay } from "../../data/consent";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Cell, DataTable, Empty, Stack, PageHeader, useNotice } from "../../ui";
import { MakeKey } from "./MakeKey";

export function AccessKeysPage() {
  const { t, lang } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const { state, reload } = useLoaded(listAccessKeys, [hub.id]);

  const revoke = async (key: AccessKey) => {
    try {
      await revokeAccessKey(key.id);
      reload();
    } catch {
      show(t("accessKeys.revokeFailed"), "bad");
    }
  };

  return (
    <>
      <PageHeader title={t("menu.access-keys")} />
      <div className="content">
        <Stack>
          <MakeKey hubId={hub.id} onMade={reload} />
          {state.kind === "failed" ? <Empty failed text={t("loadFailed")} /> : null}
          {state.kind === "ready" ? (
            <DataTable
              columns={[t("name"), t("accessKeys.madeOn")]}
              empty={t("accessKeys.none")}
              rows={state.value.map((key) => ({
                key: key.id,
                cells: [<Cell text={key.name} />, publishedDay(key.madeOn, lang)],
                actions: (
                  <Button kind="quiet" size="xs" onClick={() => revoke(key)}>
                    {t("accessKeys.revoke")}
                  </Button>
                ),
              }))}
            />
          ) : null}
        </Stack>
      </div>
    </>
  );
}
