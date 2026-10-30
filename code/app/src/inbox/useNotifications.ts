import { useEffect, useState, useSyncExternalStore } from "react";
import { type InboxClient, mcpInboxClient, type NotificationItem } from "./api";
import { unreadLabel } from "../chat/unread";

export const unreadOf = (items: NotificationItem[] | null) => (items ?? []).filter((n) => !n.read);

export const unreadCountLabel = (items: NotificationItem[] | null) => unreadLabel(unreadOf(items).length);

type Loading = { client: InboxClient; promise: Promise<void> };

let current: NotificationItem[] | null = null;
let loading: Loading | null = null;
const listeners = new Set<() => void>();
const marking = new Set<Promise<void>>();

const publish = (next: NotificationItem[] | null) => {
  current = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      current = null;
      loading = null;
    }
  };
};

const markLocally = (ids: string[]) => {
  if (current) publish(current.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
};

const markOne = (client: InboxClient, id: string) => {
  const call: Promise<void> = client
    .markRead([id])
    .then(() => markLocally([id]))
    .catch(() => undefined)
    .finally(() => marking.delete(call));
  marking.add(call);
  return call;
};

const load = (client: InboxClient) => {
  if (loading?.client === client) return loading.promise;
  const started: Loading = {
    client,
    promise: Promise.all([...marking])
      .then(() => client.listNotifications())
      .then((items) => {
        if (loading === started) publish(items);
      }),
  };
  loading = started;
  return started.promise;
};

export function useNotifications(client: InboxClient = mcpInboxClient) {
  const items = useSyncExternalStore(subscribe, () => current);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    load(client).catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [client]);

  const markAllRead = async () => {
    try {
      await client.markRead(unreadOf(current).map((n) => n.id));
    } catch {
      return false;
    }
    publish((current ?? []).map((n) => ({ ...n, read: true })));
    return true;
  };

  const markOneRead = (id: string) => markOne(client, id);

  return { items, failed, markAllRead, markOneRead };
}
