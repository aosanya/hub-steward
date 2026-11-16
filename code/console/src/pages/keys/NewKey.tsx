import { useI18n } from "../../i18n";
import type { MadeKey } from "../../data/accessKeys";
import { Card, Field, Stack } from "../../ui";

const keySpec = { name: "key", component: "readonly" } as const;

export function NewKey({ made }: { made: MadeKey }) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Field spec={keySpec} value={made.token} onChange={() => {}} />
        <p>{t("accessKeys.once")}</p>
        <code>{made.cloneLine}</code>
        <p>{t("accessKeys.password")}</p>
      </Stack>
    </Card>
  );
}
