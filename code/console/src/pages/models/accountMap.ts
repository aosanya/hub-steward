import type { Account } from "../../data/accounts";
import { modelNameOf, providerName, providerOf, providers, type Provider, type Translate } from "./catalog";

export const anthropicBase = "https://api.anthropic.com";

const plain = (base: string) => base.trim().replace(/\/+$/, "");

export const kindOf = (provider: Provider): string => (provider.id === "claude" ? "anthropic" : "openai_compatible");

export const baseOf = (provider: Provider, typed = ""): string => {
  if (provider.id === "claude") return anthropicBase;
  if (!provider.baseEditable) return provider.baseURL;
  return plain(typed) || plain(provider.baseURL);
};

export const providerOfAccount = (account: Pick<Account, "provider" | "baseUrl" | "modelName">): Provider => {
  if (account.provider === "anthropic") return providerOf("claude")!;
  const base = plain(account.baseUrl);
  const fixed = providers.find((candidate) => !candidate.baseEditable && candidate.baseURL !== "" && plain(candidate.baseURL) === base);
  if (fixed) return fixed;
  const meta = providerOf("meta")!;
  if (plain(meta.baseURL) === base) return meta;
  const open = providerOf("meta_open")!;
  if (open.models.some((model) => model.id === account.modelName)) return open;
  return providerOf("custom")!;
};

export const accountModelName = (account: Pick<Account, "provider" | "baseUrl" | "modelName">): string =>
  modelNameOf(providerOfAccount(account), account.modelName);

export const accountTitleOf = (t: Translate, account: Pick<Account, "provider" | "baseUrl" | "modelName">): string => {
  const provider = providerOfAccount(account);
  return `${providerName(t, provider)} · ${modelNameOf(provider, account.modelName)}`;
};

export const accountNameFor = (t: Translate, provider: Provider, modelId: string, taken: string[]): string => {
  const first = `${providerName(t, provider)} · ${modelNameOf(provider, modelId)}`;
  if (!taken.includes(first)) return first;
  const next = (n: number): string => (taken.includes(`${first} ${n}`) ? next(n + 1) : `${first} ${n}`);
  return next(2);
};

export const hasKey = (accounts: Pick<Account, "keySet">[]): boolean => accounts.some((account) => account.keySet);
