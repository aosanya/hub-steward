export const otherModel = "other";

export type KnownModel = { id: string; name: string };

export type Provider = {
  id: string;
  name: string;
  nameKey?: string;
  mark: string;
  keyPage: string;
  keyLabel: string;
  pasteKey: string;
  baseURL: string;
  baseEditable: boolean;
  baseHint?: string;
  defaultName: string;
  preselected: string;
  suggestsName?: boolean;
  brand?: boolean;
  models: KnownModel[];
};

export type Translate = (key: string) => string;

export type Choice = { provider: string; name?: string; base?: string };

export const providers: Provider[] = [
  {
    id: "meta",
    name: "",
    nameKey: "models.metaProvider",
    mark: "ME",
    keyPage: "https://dev.meta.ai",
    keyLabel: "models.keyLabel.meta",
    pasteKey: "models.paste",
    baseURL: "https://api.meta.ai/v1",
    baseEditable: true,
    defaultName: "",
    preselected: "muse-spark-1.3",
    brand: true,
    models: [
      { id: "muse-spark-1.3", name: "Muse Spark 1.3" },
      { id: "muse-spark-1.2", name: "Muse Spark 1.2" },
      { id: "muse-spark-1.1", name: "Muse Spark 1.1" },
      { id: "muse-spark-1.3-contributor", name: "Muse Spark 1.3 (contributor mode)" },
      { id: "muse-spark-1.2-contributor", name: "Muse Spark 1.2 (contributor mode)" },
    ],
  },
  {
    id: "meta_open",
    name: "",
    nameKey: "models.metaOpenProvider",
    mark: "ME",
    keyPage: "",
    keyLabel: "models.keyLabel.metaOpen",
    pasteKey: "models.paste",
    baseURL: "",
    baseEditable: true,
    baseHint: "models.baseAddressHintHost",
    defaultName: "",
    preselected: "",
    suggestsName: true,
    brand: true,
    models: [
      { id: "muse-spark-open", name: "Muse Spark Open" },
      { id: "muse-glimmer", name: "Muse Glimmer" },
    ],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    mark: "HF",
    keyPage: "https://huggingface.co/settings/tokens",
    keyLabel: "models.keyLabel.huggingface",
    pasteKey: "models.paste.huggingface",
    baseURL: "https://router.huggingface.co/v1",
    baseEditable: false,
    defaultName: "zai-org/GLM-5.3:novita",
    preselected: "",
    models: [{ id: "zai-org/GLM-5.3:novita", name: "GLM-5.3" }],
  },
  {
    id: "claude",
    name: "Claude",
    mark: "CL",
    keyPage: "https://console.anthropic.com/settings/keys",
    keyLabel: "models.keyLabel.claude",
    pasteKey: "models.paste.claude",
    baseURL: "https://api.anthropic.com/v1",
    baseEditable: false,
    defaultName: "claude-sonnet-5-5",
    preselected: "",
    models: [
      { id: "claude-haiku-5-5", name: "Haiku 5.5" },
      { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
      { id: "claude-opus-5-5", name: "Opus 5.5" },
      { id: "claude-fable-5-1", name: "Fable 5.1" },
    ],
  },
  {
    id: "custom",
    name: "",
    nameKey: "models.otherProvider",
    mark: "OT",
    keyPage: "",
    keyLabel: "models.keyLabel.custom",
    pasteKey: "models.paste",
    baseURL: "",
    baseEditable: true,
    baseHint: "models.baseAddressHint",
    defaultName: "",
    preselected: "",
    models: [],
  },
];

export const providerOf = (id = ""): Provider | undefined => providers.find((p) => p.id === id);

const serverDefaultProvider = "huggingface";

export const providerOrDefault = (id = ""): Provider => providerOf(id) ?? providerOf(serverDefaultProvider)!;

export const providerName = (t: Translate, provider: Provider) => (provider.nameKey ? t(provider.nameKey) : provider.name);

export const modelOptionLabel = (model: KnownModel) => `${model.name} (${model.id})`;

export const modelFriendlyName = (id: string) => providers.flatMap((p) => p.models).find((m) => m.id === id)?.name ?? id;

export const modelNameOf = (provider: Provider, id: string) => provider.models.find((m) => m.id === id)?.name ?? id;

export const choiceLabel = (t: Translate, choice: Choice) => {
  const provider = providerOrDefault(choice.provider);
  const id = choice.name ?? provider.defaultName;
  const known = provider.models.find((m) => m.id === id);
  return known ? `${providerName(t, provider)} ${known.name}` : id || providerName(t, provider);
};

export type Target = { provider: string; base?: string };

const plainBase = (base = "") => base.trim().replace(/\/+$/, "");

export const targetOf = (choice: Choice): Target => ({
  provider: choice.provider,
  base: providerOf(choice.provider)?.baseEditable ? plainBase(choice.base) : undefined,
});

export type ModelOption = { value: string; label: string };

export type ModelMenu = { current: ModelOption[]; fromKey: ModelOption[]; standard: ModelOption[] };

export const modelMenu = (provider: Provider, listed: string[], selected = ""): ModelMenu => {
  const standardIds = provider.models.map((m) => m.id);
  const named = (id: string) => ({ value: id, label: id });
  const unlisted = selected !== "" && selected !== otherModel && !standardIds.includes(selected) && !listed.includes(selected);
  return {
    current: unlisted ? [named(selected)] : [],
    fromKey: [...new Set(listed)].filter((id) => !standardIds.includes(id)).map(named),
    standard: provider.models.map((m) => ({ value: m.id, label: provider.suggestsName ? m.name : modelOptionLabel(m) })),
  };
};

export type AddStart = { provider: string; model: string; base?: string };

export const addStartOf = (provider: Provider, model: string): AddStart => ({ provider: provider.id, model, base: provider.baseURL });

export const firstAddStart = (): AddStart => {
  const first = providers[0];
  return addStartOf(first, first.preselected);
};

export type Available = { provider: Provider; model: KnownModel };

export const availableToAdd: Available[] = providers.flatMap((provider) => provider.models.map((model) => ({ provider, model })));
