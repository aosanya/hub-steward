import { useState } from "react";
import { otherModel, providerOf, targetOf, type Choice, type Target } from "./catalog";

type Start = { provider: string; model: string; base?: string };

const suggestedName = (providerId: string, model: string) => (providerOf(providerId)?.suggestsName && model !== otherModel ? model : "");

export function useModelChoice(start?: Start) {
  const [providerId, setProviderId] = useState(start?.provider ?? "");
  const [model, setModelState] = useState(start?.model ?? "");
  const [typedName, setName] = useState(suggestedName(start?.provider ?? "", start?.model ?? ""));
  const [typedBase, setBase] = useState(start?.base ?? "");

  const provider = providerOf(providerId);
  const usesOther = model === otherModel;
  const showsName = provider?.suggestsName ? model !== "" : usesOther;
  const name = showsName ? typedName.trim() : model;
  const base = provider?.baseEditable ? typedBase.trim() : "";
  const baseRefused = base !== "" && !/^https:\/\//i.test(base);
  const chosen = provider !== undefined && model !== "";
  const addressReady = provider !== undefined && (!provider.baseEditable || (base !== "" && !baseRefused));
  const complete = chosen && name !== "" && addressReady;

  const choice: Choice = { provider: providerId, name: name || undefined, base: base || undefined };
  const target: Target | null = provider ? targetOf(choice) : null;
  const keyChoice: Choice | null = complete ? choice : provider ? { provider: providerId, base: base || undefined } : null;
  const changed = start !== undefined && (model !== start.model || (showsName && name !== (provider?.suggestsName ? start.model : "")));

  const setModel = (value: string) => {
    setModelState(value);
    if (provider?.suggestsName && value !== "" && value !== otherModel) setName(value);
  };

  const setProvider = (id: string) => {
    const next = providerOf(id);
    const preselected = next ? next.preselected || (next.models.length === 0 ? otherModel : "") : "";
    setProviderId(id);
    setModelState(preselected);
    setName(suggestedName(id, preselected));
    setBase(next?.baseURL ?? "");
  };

  const settle = (id: string) => {
    setModelState(id);
    setName(suggestedName(providerId, id));
  };

  return {
    provider,
    model,
    typedName,
    typedBase,
    usesOther,
    showsName,
    baseRefused,
    chosen,
    addressReady,
    complete,
    changed,
    choice,
    keyChoice,
    target,
    setProvider,
    setModel,
    setName,
    setBase,
    settle,
  };
}

export type ModelChoiceState = ReturnType<typeof useModelChoice>;
