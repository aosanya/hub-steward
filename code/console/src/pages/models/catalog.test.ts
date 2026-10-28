import { addStartOf, availableToAdd, choiceLabel, firstAddStart, modelNameOf, modelOptionLabel, otherModel, providerName, providerOf, providerOrDefault, providers } from "./catalog";

const words: Record<string, string> = {
  "models.metaProvider": "Meta Model API",
  "models.metaOpenProvider": "Meta open weights (Baseten, Modal or your own server)",
  "models.otherProvider": "Other (OpenAI-compatible)",
};
const t = (key: string) => words[key] ?? key;

describe("the providers a hub can use", () => {
  it("are Meta Model API, Meta open weights, Hugging Face, Claude and Other, in that order", () => {
    expect(providers.map((p) => p.id)).toEqual(["meta", "meta_open", "huggingface", "claude", "custom"]);
    expect(providers.map((p) => providerName(t, p))).toEqual(["Meta Model API", "Meta open weights (Baseten, Modal or your own server)", "Hugging Face", "Claude", "Other (OpenAI-compatible)"]);
  });

  it("list the models of Hugging Face and Claude with their ids, the Muse Spark models for Meta Model API, and none for Other", () => {
    expect(providerOf("huggingface")?.models).toEqual([{ id: "zai-org/GLM-5.3:novita", name: "GLM-5.3" }]);
    expect(providerOf("claude")?.models.map((m) => [m.name, m.id])).toEqual([
      ["Haiku 5.5", "claude-haiku-5-5"],
      ["Sonnet 5.5", "claude-sonnet-5-5"],
      ["Opus 5.5", "claude-opus-5-5"],
      ["Fable 5.1", "claude-fable-5-1"],
    ]);
    expect(providerOf("meta")?.models.map((m) => [m.name, m.id])).toEqual([
      ["Muse Spark 1.3", "muse-spark-1.3"],
      ["Muse Spark 1.2", "muse-spark-1.2"],
      ["Muse Spark 1.1", "muse-spark-1.1"],
      ["Muse Spark 1.3 (contributor mode)", "muse-spark-1.3-contributor"],
      ["Muse Spark 1.2 (contributor mode)", "muse-spark-1.2-contributor"],
    ]);
    expect(providerOf("custom")?.models).toEqual([]);
  });

  it("fix the address of Hugging Face and Claude, prefill Meta's and leave Meta open weights' and Other's empty", () => {
    expect(providers.map((p) => [p.id, p.baseURL, p.baseEditable])).toEqual([
      ["meta", "https://api.meta.ai/v1", true],
      ["meta_open", "", true],
      ["huggingface", "https://router.huggingface.co/v1", false],
      ["claude", "https://api.anthropic.com/v1", false],
      ["custom", "", true],
    ]);
  });

  it("give Hugging Face and Claude a default model name, and Meta Model API, Meta open weights and Other none", () => {
    expect(providers.map((p) => p.defaultName)).toEqual(["", "", "zai-org/GLM-5.3:novita", "claude-sonnet-5-5", ""]);
  });

  it("point to a key page for all but Meta open weights and Other", () => {
    expect(providers.map((p) => p.keyPage)).toEqual([
      "https://dev.meta.ai",
      "",
      "https://huggingface.co/settings/tokens",
      "https://console.anthropic.com/settings/keys",
      "",
    ]);
  });

  it("start with Muse Spark 1.3 chosen for Meta Model API and with nothing chosen for the others", () => {
    expect(providers.map((p) => p.preselected)).toEqual(["muse-spark-1.3", "", "", "", ""]);
    expect(providerOf("meta")?.models.map((m) => m.id)).toContain("muse-spark-1.3");
  });

  it("leave Meta Model API with no default model name, since the server needs a name for it", () => {
    expect(providerOf("meta")?.defaultName).toBe("");
  });

  it("put Meta Model API first and start an add on its Muse Spark 1.3 at the Meta address", () => {
    expect(providers[0].id).toBe("meta");
    expect(firstAddStart()).toEqual({ provider: "meta", model: "muse-spark-1.3", base: "https://api.meta.ai/v1" });
  });

  it("name a Muse Spark model by its friendly name and its id", () => {
    const meta = providerOf("meta")!;
    expect(modelNameOf(meta, "muse-spark-1.3-contributor")).toBe("Muse Spark 1.3 (contributor mode)");
    expect(modelOptionLabel({ id: "muse-spark-1.3-contributor", name: "Muse Spark 1.3 (contributor mode)" })).toBe(
      "Muse Spark 1.3 (contributor mode) (muse-spark-1.3-contributor)",
    );
  });

  it("fall back to Hugging Face for a provider nobody knows", () => {
    expect(providerOf("mistral")).toBeUndefined();
    expect(providerOrDefault("mistral").id).toBe("huggingface");
    expect(providerOrDefault().id).toBe("huggingface");
  });
});

describe("naming a model", () => {
  it("names a known model by its friendly name and an unknown one by its id", () => {
    const claude = providerOrDefault("claude");
    expect(modelNameOf(claude, "claude-opus-5-5")).toBe("Opus 5.5");
    expect(modelNameOf(claude, "claude-next")).toBe("claude-next");
  });

  it("writes a listed model as the friendly name with the id in brackets", () => {
    expect(modelOptionLabel({ id: "claude-opus-5-5", name: "Opus 5.5" })).toBe("Opus 5.5 (claude-opus-5-5)");
  });

  it("names the key label and the placeholder for each provider", () => {
    expect(providers.map((p) => [p.keyLabel, p.pasteKey])).toEqual([
      ["models.keyLabel.meta", "models.paste"],
      ["models.keyLabel.metaOpen", "models.paste"],
      ["models.keyLabel.huggingface", "models.paste.huggingface"],
      ["models.keyLabel.claude", "models.paste.claude"],
      ["models.keyLabel.custom", "models.paste"],
    ]);
  });
});

describe("how a model just added is named", () => {
  it("is the provider and the friendly name for a model the list knows", () => {
    expect(choiceLabel(t, { provider: "claude", name: "claude-sonnet-5-5" })).toBe("Claude Sonnet 5.5");
    expect(choiceLabel(t, { provider: "huggingface", name: "zai-org/GLM-5.3:novita" })).toBe("Hugging Face GLM-5.3");
  });

  it("is the provider's default model when no name was chosen", () => {
    expect(choiceLabel(t, { provider: "claude" })).toBe("Claude Sonnet 5.5");
    expect(choiceLabel(t, { provider: "huggingface" })).toBe("Hugging Face GLM-5.3");
  });

  it("is the typed name alone for a model the list does not know", () => {
    expect(choiceLabel(t, { provider: "meta", name: "muse-spark-open", base: "https://api.meta.ai/v1" })).toBe("muse-spark-open");
    expect(choiceLabel(t, { provider: "claude", name: "claude-future-9" })).toBe("claude-future-9");
  });

  it("is the provider's name when there is neither a name nor a default", () => {
    expect(choiceLabel(t, { provider: "custom" })).toBe("Other (OpenAI-compatible)");
  });
});

describe("the models available to add", () => {
  it("are every provider's listed models, in provider order, Meta Model API's first", () => {
    expect(availableToAdd.map((a) => [a.provider.id, a.model.id]).slice(0, 2)).toEqual([
      ["meta", "muse-spark-1.3"],
      ["meta", "muse-spark-1.2"],
    ]);
    expect(availableToAdd).toHaveLength(providers.reduce((sum, p) => sum + p.models.length, 0));
    expect(availableToAdd.map((a) => a.provider.id)).not.toContain("custom");
  });

  it("start an add on a provider's own address and the model chosen", () => {
    const claude = providerOf("claude")!;
    expect(addStartOf(claude, "claude-opus-5-5")).toEqual({ provider: "claude", model: "claude-opus-5-5", base: "https://api.anthropic.com/v1" });
  });
});

describe("Other model", () => {
  it("is offered with an id no model can have", () => {
    expect(providers.flatMap((p) => p.models.map((m) => m.id))).not.toContain(otherModel);
  });
});
