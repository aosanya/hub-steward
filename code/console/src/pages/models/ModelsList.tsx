import { useState } from "react";
import { hubPath } from "../../api";
import { byName, matching } from "../../data/listView";
import { deleteAccount, ensureDefaultAccount, listAccounts, type Account } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { ButtonLink, Empty, FilterBar, Stack, TitleRow, useNotice } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { accountModelName, accountTitleOf } from "./accountMap";
import { AvailableModels } from "./AvailableModels";
import { ModelCard } from "./ModelsListRows";
import { RemoveModel } from "./RemoveModel";

const listWithDefault = async (hubId: string): Promise<Account[]> => {
  const listed = await listAccounts(hubId);
  try {
    return await ensureDefaultAccount(hubId, listed);
  } catch {
    return listed;
  }
};

export function ModelsList() {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const { state: accounts, reload } = useLoaded(() => listWithDefault(hub.id), [hub.id]);
  const [asking, setAsking] = useState<Account | null>(null);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");

  const held = accounts.kind === "ready" ? accounts.value : [];
  const listed = byName(
    matching(held, (account) => [accountModelName(account), account.modelName, accountTitleOf(t, account)], search),
    accountModelName,
  );
  const addTo = hubPath(hub.id, "models", "new");

  const remove = async (account: Account) => {
    setRemoving(true);
    try {
      await deleteAccount(hub.id, account.id);
      setAsking(null);
      reload();
      show(t("models.removed").replace("{model}", accountTitleOf(t, account)));
    } catch {
      show(t("models.removeFailed"), "bad");
    }
    setRemoving(false);
  };

  return (
    <>
      <TitleRow title={t("models.title")} primary={held.length > 0 ? t("models.addModel") : undefined} primaryTo={addTo} />
      <div className="content">
        <Stack gap={28}>
          {accounts.kind === "failed" && <Empty failed text={t("loadFailed")} />}
          {accounts.kind === "ready" && held.length === 0 && (
            <Empty text={t("models.none")} action={<ButtonLink to={addTo}>{t("models.addModel")}</ButtonLink>} />
          )}
          {held.length > 0 && (
            <Stack gap={20}>
              {asking && (
                <RemoveModel
                  title={accountTitleOf(t, asking)}
                  busy={removing}
                  onConfirm={() => remove(asking)}
                  onCancel={() => setAsking(null)}
                />
              )}
              <FilterBar placeholder={t("models.search")} chips={[]} search={search} onSearch={setSearch} />
              {listed.length === 0 ? (
                <Empty text={t("models.none")} />
              ) : (
                listed.map((account) => <ModelCard key={account.id} t={t} hubId={hub.id} account={account} onRemove={setAsking} />)
              )}
            </Stack>
          )}
          {accounts.kind === "ready" && <AvailableModels accounts={held} />}
        </Stack>
      </div>
    </>
  );
}
