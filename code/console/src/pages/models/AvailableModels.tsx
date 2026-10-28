import type { Account } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Chip, DataTable, Row, SectionTitle, Stack, TextLink, type TableRowData } from "../../ui";
import { providerOfAccount } from "./accountMap";
import { addPathOf } from "./addStartLink";
import { addStartOf, providerName, providers, type Provider, type Translate } from "./catalog";
import { BrandChip } from "./ProviderMark";

type Props = { accounts: Account[] };

const withModels = providers.filter((provider) => provider.models.length > 0);

const isAdded = (accounts: Account[], provider: Provider, modelId: string) =>
  accounts.some((account) => account.modelName === modelId && providerOfAccount(account).id === provider.id);

function GroupHead({ provider }: { provider: Provider }) {
  const { t } = useI18n();
  return (
    <Row>
      <strong>{providerName(t, provider)}</strong>
      <BrandChip provider={provider} />
      {provider.suggestsName && <span className="muted">{t("models.hostGives")}</span>}
    </Row>
  );
}

const rowsOf = (t: Translate, hubId: string, provider: Provider, accounts: Account[]): TableRowData[] =>
  provider.models.map((model) => ({
    key: model.id,
    cells: [
      <span className="mk-nowrap" key="model">
        {model.name}
      </span>,
      <span className="count mk-nowrap" key="id">
        {model.id}
      </span>,
    ],
    actions: isAdded(accounts, provider, model.id) ? (
      <Chip>{t("models.addedMark")}</Chip>
    ) : (
      <TextLink size="sm" to={addPathOf(hubId, addStartOf(provider, model.id))}>
        {t("models.add")}
      </TextLink>
    ),
  }));

export function AvailableModels({ accounts }: Props) {
  const { t } = useI18n();
  const { hub } = useConsole();
  return (
    <Stack gap={12}>
      <SectionTitle title={t("models.available")} />
      {withModels.map((provider) => (
        <div className={provider.brand ? undefined : "mk-quiet"} key={provider.id}>
          <Stack gap={10}>
            <GroupHead provider={provider} />
            <DataTable columns={[t("models.colModel"), t("models.colModelId")]} rows={rowsOf(t, hub.id, provider, accounts)} empty="" />
          </Stack>
        </div>
      ))}
    </Stack>
  );
}
