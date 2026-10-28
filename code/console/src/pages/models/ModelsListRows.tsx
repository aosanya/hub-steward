import { useState } from "react";
import { hubPath } from "../../api";
import type { Account } from "../../data/accounts";
import { Card, Chip, Detail, TextLink } from "../../ui";
import { accountModelName, providerOfAccount } from "./accountMap";
import type { Translate } from "./catalog";
import { ProviderChips } from "./ProviderMark";
import { UsedBy } from "./ModelsListUsedBy";

type ModelCardProps = { t: Translate; hubId: string; account: Account; onRemove: (account: Account) => void };

export function ModelCard({ t, hubId, account, onRemove }: ModelCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={accountModelName(account)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <>
          <TextLink size="sm" to={hubPath(hubId, "models", account.id, "key")}>
            {t("models.edit")}
          </TextLink>
          <TextLink size="sm" onClick={() => onRemove(account)}>
            {t("models.remove")}
          </TextLink>
        </>
      }
    >
      <Detail
        pairs={[
          [t("models.provider"), <ProviderChips key="provider" provider={providerOfAccount(account)} />],
          [t("models.colModelId"), <span key="id" className="count">{account.modelName}</span>],
          [
            t("models.colKey"),
            account.keySet ? (
              <Chip key="key" kind="ok">
                {t("modelKeySet")}
              </Chip>
            ) : (
              <Chip key="key" kind="warn">
                {t("models.noKey")}
              </Chip>
            ),
          ],
          [t("models.colUsedBy"), <UsedBy key="users" accountId={account.id} />],
        ]}
      />
    </Card>
  );
}
