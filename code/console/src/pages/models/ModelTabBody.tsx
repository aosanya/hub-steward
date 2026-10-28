import { modelAccounts } from "../../data/modelLimits";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { LimitsForm } from "../limits/LimitsForm";
import { UsageBlock } from "../limits/UsageBlock";
import { ModelMissing } from "./ModelMissing";
import type { ModelTab } from "./ModelTabs";
import { ModelUsers } from "./ModelUsers";

export function ModelTabBody({ accountId, tab }: { accountId: string; tab: Exclude<ModelTab, "key"> }) {
  const { hub } = useConsole();
  const { state: models } = useLoaded(() => modelAccounts(hub.id), [hub.id]);

  if (models.kind === "loading") return null;
  const account = models.kind === "ready" ? models.value.find((model) => model.id === accountId) : undefined;
  if (!account) return <ModelMissing />;

  if (tab === "limits") return <LimitsForm account={account} />;
  if (tab === "users") return <ModelUsers account={account} />;
  return <UsageBlock account={account} />;
}
