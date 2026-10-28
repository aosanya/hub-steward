import { useCallback, useEffect, useState } from "react";
import { chatAccounts, listAccounts } from "../data/accounts";
import { keepChatModelPick, pickedChatModel } from "../data/chatModels";
import { accountModelName } from "../pages/models/accountMap";

export type ChatModelOption = { id: string; label: string };

type Loaded = { hubId: string; options: ChatModelOption[]; modelCount: number; stored: string };

type Listed = { options: ChatModelOption[]; modelCount: number };

const noOptions: ChatModelOption[] = [];

const noneListed: Listed = { options: noOptions, modelCount: 0 };

export const chatModelKey = (hubId: string) => `hubsteward.chatModel.${hubId}`;

export const chatModelKeptKey = (hubId: string) => `hubsteward.chatModelKept.${hubId}`;

const readKey = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeKey = (key: string, id: string) => {
  try {
    localStorage.setItem(key, id);
  } catch {}
};

const offers = (options: ChatModelOption[], id: string) => options.some((option) => option.id === id);

const chosenOf = (options: ChatModelOption[], serverPick: string, stored: string, kept: string) => {
  const serverNeverSawStored = offers(options, stored) && stored !== kept;
  return serverNeverSawStored || !offers(options, serverPick) ? stored : serverPick;
};

const listedOf = async (hubId: string): Promise<Listed> => {
  try {
    const accounts = await listAccounts(hubId);
    const options = chatAccounts(accounts).map((account) => ({ id: account.id, label: account.chatLabel.trim() || accountModelName(account) }));
    return { options, modelCount: accounts.length };
  } catch {
    return noneListed;
  }
};

export function useChatModels(hubId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([listedOf(hubId), pickedChatModel(hubId)]).then(([{ options, modelCount }, picked]) => {
      const stored = chosenOf(options, picked, readKey(chatModelKey(hubId)), readKey(chatModelKeptKey(hubId)));
      if (live) setLoaded({ hubId, options, modelCount, stored });
    });
    return () => {
      live = false;
    };
  }, [hubId]);

  const mine = loaded?.hubId === hubId ? loaded : null;
  const options = mine?.options ?? noOptions;
  const hasModels = (mine?.modelCount ?? 0) > 0;
  const currentId = options.find((option) => option.id === mine?.stored)?.id ?? options[0]?.id ?? "";

  const pick = useCallback(
    (id: string) => {
      if (!options.some((option) => option.id === id)) return;
      writeKey(chatModelKey(hubId), id);
      keepChatModelPick(hubId, id).then((kept) => {
        if (kept) writeKey(chatModelKeptKey(hubId), id);
      });
      setLoaded((before) => (before?.hubId === hubId ? { ...before, stored: id } : before));
    },
    [hubId, options],
  );

  return { options, currentId, pick, hasModels };
}
