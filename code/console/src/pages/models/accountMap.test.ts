import { describe, expect, it } from "vitest";
import { accountModelName, accountNameFor, accountTitleOf, anthropicBase, baseOf, hasKey, kindOf, providerOfAccount } from "./accountMap";
import { providerOf } from "./catalog";

const t = (key: string) => ({ "models.metaProvider": "Meta Model API", "models.otherProvider": "Other (OpenAI-compatible)", "models.metaOpenProvider": "Meta open weights" })[key] ?? key;

const account = (provider: string, baseUrl: string, modelName: string) => ({ provider, baseUrl, modelName });

describe("the account to provider mapping", () => {
  it("reads Hugging Face by its fixed address", () => {
    expect(providerOfAccount(account("openai_compatible", "https://router.huggingface.co/v1/", "zai-org/GLM-5.3:novita")).id).toBe("huggingface");
  });

  it("reads Claude by the provider kind and sends the address the adapter expects", () => {
    expect(providerOfAccount(account("anthropic", anthropicBase, "claude-sonnet-5-5")).id).toBe("claude");
    expect(baseOf(providerOf("claude")!)).toBe(anthropicBase);
    expect(kindOf(providerOf("claude")!)).toBe("anthropic");
  });

  it("reads the Meta Model API by its address and Meta open weights by their model", () => {
    expect(providerOfAccount(account("openai_compatible", "https://api.meta.ai/v1", "muse-spark-1.3")).id).toBe("meta");
    expect(providerOfAccount(account("openai_compatible", "https://muse.example.com/v1", "muse-spark-open")).id).toBe("meta_open");
  });

  it("falls back to Other for any other address", () => {
    expect(providerOfAccount(account("openai_compatible", "https://llm.example.org/v1", "my-org/llama-4-open")).id).toBe("custom");
  });

  it("keeps a typed address for the providers that take one, trimmed", () => {
    expect(baseOf(providerOf("custom")!, " https://llm.example.org/v1/ ")).toBe("https://llm.example.org/v1");
    expect(baseOf(providerOf("meta")!, "")).toBe("https://api.meta.ai/v1");
    expect(baseOf(providerOf("huggingface")!, "https://elsewhere.example")).toBe("https://router.huggingface.co/v1");
    expect(kindOf(providerOf("meta")!)).toBe("openai_compatible");
  });

  it("titles an account by provider and the model's friendly name", () => {
    const meta = account("openai_compatible", "https://api.meta.ai/v1", "muse-spark-1.3");
    expect(accountTitleOf(t, meta)).toBe("Meta Model API · Muse Spark 1.3");
    expect(accountModelName(meta)).toBe("Muse Spark 1.3");
  });

  it("names a new account so that it is unique in the hub", () => {
    const meta = providerOf("meta")!;
    expect(accountNameFor(t, meta, "muse-spark-1.3", [])).toBe("Meta Model API · Muse Spark 1.3");
    expect(accountNameFor(t, meta, "muse-spark-1.3", ["Meta Model API · Muse Spark 1.3"])).toBe("Meta Model API · Muse Spark 1.3 2");
    expect(accountNameFor(t, meta, "muse-spark-1.3", ["Meta Model API · Muse Spark 1.3", "Meta Model API · Muse Spark 1.3 2"])).toBe("Meta Model API · Muse Spark 1.3 3");
  });

  it("says whether any account holds a key", () => {
    expect(hasKey([{ keySet: false }, { keySet: true }])).toBe(true);
    expect(hasKey([])).toBe(false);
  });
});
