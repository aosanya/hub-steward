import { useEffect, useState } from "react";
import { chatAccounts, createAccount, listAccounts, setAccountKey, testAccount, updateAccount, type Account } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useNotice } from "../../ui";
import { accountNameFor, baseOf, kindOf } from "./accountMap";
import { chatLabelLimit } from "./ChatFields";
import { choiceLabel, providerOf, type Choice } from "./catalog";
import type { KeyLine } from "./KeyResult";
import { sentenceOf, useTestRun } from "./useTestRun";

export function useAddModel(ownName: string) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const testing = useTestRun();
  const [account, setAccount] = useState<Account | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [line, setLine] = useState<KeyLine | null>(null);
  const [held, setHeld] = useState<Account[] | null>(null);
  const [chatPick, setChatPick] = useState<boolean | null>(null);
  const [typedLabel, setTypedLabel] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const read = async () => {
      try {
        const listed = await listAccounts(hub.id);
        if (current && Array.isArray(listed)) setHeld(listed);
      } catch {
        return;
      }
    };
    read();
    return () => {
      current = false;
    };
  }, [hub.id]);

  const chatOffered = (accounts: Account[] | null) => accounts === null || chatAccounts(accounts).length === 0;
  const chatEnabled = chatPick ?? chatOffered(held);
  const chatLabel = typedLabel ?? ownName;
  const sentLabel = chatLabel.trim() === ownName ? "" : chatLabel.trim();

  const failure = (text: string) => setLine({ text, failed: true });

  const createFor = async (choice: Choice): Promise<Account | null> => {
    const provider = providerOf(choice.provider);
    const modelId = choice.name ?? provider?.defaultName ?? "";
    if (!provider || modelId === "") return null;
    if (sentLabel.length > chatLabelLimit) {
      failure(t("models.chatLabelTooLong").replace("{max}", String(chatLabelLimit)));
      return null;
    }
    try {
      const fresh = await listAccounts(hub.id);
      const wantsChat = chatPick ?? chatOffered(fresh);
      const created = await createAccount(hub.id, {
        name: accountNameFor(
          t,
          provider,
          modelId,
          fresh.map((each) => each.name),
        ),
        provider: kindOf(provider),
        baseUrl: baseOf(provider, choice.base),
        modelName: modelId,
        chatEnabled: wantsChat,
        chatLabel: sentLabel,
      });
      setAccount(created);
      setChatPick(wantsChat);
      show(t("models.added").replace("{model}", choiceLabel(t, choice)));
      return created;
    } catch (error) {
      failure(sentenceOf(error) || t("models.modelFailed"));
      return null;
    }
  };

  const keyFor = async (held: Account) => {
    const sent = key;
    try {
      setAccount(await setAccountKey(hub.id, held.id, sent));
      setKey("");
    } catch (error) {
      failure(sentenceOf(error, sent.trim()) || t("models.failed"));
    }
  };

  const save = async (choice: Choice) => {
    setSaving(true);
    setLine(null);
    testing.clear();
    try {
      const held = account ?? (await createFor(choice));
      if (held && key.trim() !== "") await keyFor(held);
    } finally {
      setSaving(false);
    }
  };

  const changeModel = async (choice: Choice) => {
    const modelId = choice.name ?? providerOf(choice.provider)?.defaultName ?? "";
    if (!account || modelId === "") return;
    setSaving(true);
    setLine(null);
    try {
      setAccount(await updateAccount(hub.id, account.id, { modelName: modelId }));
      show(t("notice.modelSaved").replace("{model}", choiceLabel(t, choice)));
    } catch (error) {
      failure(sentenceOf(error) || t("models.modelFailed"));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!account) return;
    await testing.start(() => testAccount(hub.id, account.id, key));
  };

  return {
    account,
    added: account !== null,
    keyHeld: account?.keySet === true,
    key,
    setKey,
    chatEnabled,
    setChatEnabled: setChatPick,
    chatLabel,
    setChatLabel: setTypedLabel,
    saved: account !== null && key.trim() === "",
    saving,
    testing: testing.busy,
    run: testing.run,
    line,
    save,
    changeModel,
    test,
  };
}

export type AddModelForm = ReturnType<typeof useAddModel>;
