import { useState } from "react";
import { chatAccounts, getAccount, listAccounts, setAccountKey, testAccount, updateAccount, type Account } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useNotice } from "../../ui";
import { providerOfAccount } from "./accountMap";
import { choiceLabel, modelNameOf, otherModel } from "./catalog";
import { sentenceOf, useTestRun, type TestRun } from "./useTestRun";

export type Editable = { account: Account; chatLocked: boolean };

type Saved = { modelName: string; chatEnabled: boolean; chatLabel: string };

const idle: TestRun = { phase: "idle" };

const workingResult = "working";

export async function loadEditable(hubId: string, accountId: string): Promise<Editable> {
  const [account, accounts] = await Promise.all([getAccount(hubId, accountId), listAccounts(hubId)]);
  const usable = chatAccounts(accounts);
  return { account, chatLocked: usable.length === 1 && usable[0].id === account.id };
}

export const lastRunOf = (account: Account): TestRun => {
  const result = account.lastTestResult.trim();
  if (account.lastTestedAt === "" || result === "") return idle;
  const working = result === workingResult;
  return {
    phase: "done",
    working,
    reason: working ? "" : result,
    prompt: account.lastTestPrompt,
    reply: account.lastTestReply,
    tookMs: account.lastTestMs,
  };
};

const savedOf = (account: Account): Saved => ({
  modelName: account.modelName,
  chatEnabled: account.chatEnabled,
  chatLabel: account.chatLabel.trim(),
});

export function useEditModel({ account, chatLocked }: Editable, onSaved: () => void) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const testing = useTestRun();
  const provider = providerOfAccount(account);
  const [saved, setSaved] = useState<Saved>(savedOf(account));
  const [model, setModelState] = useState(account.modelName);
  const [typedName, setTypedName] = useState(provider.suggestsName ? account.modelName : "");
  const [chatEnabled, setChatEnabled] = useState(account.chatEnabled || chatLocked);
  const [chatLabel, setChatLabel] = useState(saved.chatLabel);
  const [key, setKey] = useState("");
  const [keySet, setKeySet] = useState(account.keySet);
  const [lastRun, setLastRun] = useState<TestRun>(() => lastRunOf(account));
  const [saving, setSaving] = useState(false);

  const showsName = provider.suggestsName ? model !== "" : model === otherModel;
  const name = (showsName ? typedName : model).trim();
  const changed = name !== saved.modelName || chatEnabled !== saved.chatEnabled || chatLabel.trim() !== saved.chatLabel;
  const keyTyped = key.trim() !== "";
  const dirty = changed || keyTyped;
  const busy = saving || testing.busy;
  const canSave = dirty && !busy && (!changed || name !== "");
  const log = testing.run.phase === "idle" ? lastRun : testing.run;

  const setModel = (value: string) => {
    setModelState(value);
    if (provider.suggestsName && value !== "" && value !== otherModel) setTypedName(value);
  };

  const cancel = () => {
    setModelState(saved.modelName);
    setTypedName(provider.suggestsName ? saved.modelName : "");
    setChatEnabled(saved.chatEnabled || chatLocked);
    setChatLabel(saved.chatLabel);
    setKey("");
  };

  const saveChanges = async (sent: string): Promise<Saved | null> => {
    const next: Saved = { modelName: name, chatEnabled, chatLabel: chatLabel.trim() };
    try {
      await updateAccount(hub.id, account.id, next);
      setSaved(next);
      return next;
    } catch (error) {
      show(sentenceOf(error, sent) || t("models.modelFailed"), "bad");
      return null;
    }
  };

  const saveKey = async (sent: string, held: Saved) => {
    try {
      await setAccountKey(hub.id, account.id, sent);
    } catch (error) {
      show(sentenceOf(error, sent) || t("models.failed"), "bad");
      return;
    }
    setKey("");
    setKeySet(true);
    setLastRun(idle);
    testing.clear();
    show(t("notice.keyReplaced").replace("{model}", choiceLabel(t, { provider: provider.id, name: held.modelName })));
    onSaved();
  };

  const save = async () => {
    const sent = key.trim();
    setSaving(true);
    const held = changed ? await saveChanges(sent) : saved;
    if (held && sent !== "") await saveKey(sent, held);
    else if (held) {
      show(t("notice.modelSaved").replace("{model}", choiceLabel(t, { provider: provider.id, name: held.modelName })));
      onSaved();
    }
    setSaving(false);
  };

  const test = () => testing.start(() => testAccount(hub.id, account.id, key));

  return {
    provider,
    model,
    typedName,
    showsName,
    name,
    chatEnabled,
    chatLabel,
    chatLabelHint: modelNameOf(provider, name || saved.modelName),
    key,
    keyTyped,
    keySet,
    changed,
    dirty,
    canSave,
    saving,
    busy,
    log,
    setModel,
    setTypedName,
    setChatEnabled,
    setChatLabel,
    setKey,
    cancel,
    save,
    test,
  };
}

export type EditModel = ReturnType<typeof useEditModel>;
