import { useEffect, useState, useSyncExternalStore } from "react";
import { type InboxClient, mcpInboxClient, type NotificationItem } from "./api";
import { unreadLabel } from "../chat/unread";
import { isOutage } from "./outage";
import { onRegainFocus } from "./regainFocus";

export const unreadOf = (items: NotificationItem[] | null) => (items ?? []).filter((n) => !n.read);

export const unreadCountLabel = (items: NotificationItem[] | null) => unreadLabel(unreadOf(items).length);

type Loading = { client: InboxClient; promise: Promise<void>; done: boolean };

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
  const started: Loading = { client, done: false, promise: Promise.resolve() };
  started.promise = Promise.all([...marking])
    .then(() => client.listNotifications())
    .then((items) => {
      if (loading === started) publish(items);
    })
    .finally(() => {
      started.done = true;
    });
  loading = started;
  return started.promise;
};

const reload = (client: InboxClient) => {
  if (loading?.client === client && !loading.done) return loading.promise;
  loading = null;
  return load(client);
};

export function useNotifications(client: InboxClient = mcpInboxClient) {
  const items = useSyncExternalStore(subscribe, () => current);
  const [failed, setFailed] = useState(false);
  const [outage, setOutage] = useState(false);

  const fetch = (live: () => boolean, read = load) =>
    read(client).then(
      () => {
        if (!live()) return;
        setFailed(false);
        setOutage(false);
      },
      (error) => {
        if (!live()) return;
        setFailed(true);
        setOutage(isOutage(error));
      },
    );

  useEffect(() => {
    let live = true;
    fetch(() => live);
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    let live = true;
    const stop = onRegainFocus(() => void fetch(() => live, reload));
    return () => {
      live = false;
      stop();
    };
  }, [client]);

  const retry = () => {
    loading = null;
    setFailed(false);
    setOutage(false);
    fetch(() => true);
  };

  const markIdsRead = async (ids: string[]) => {
    try {
      await client.markRead(ids);
    } catch {
      return false;
    }
    markLocally(ids);
    return true;
  };

  const markAllRead = () => markIdsRead(unreadOf(current).map((n) => n.id));

  const markOneRead = (id: string) => markOne(client, id);

  return { items, failed, outage, retry, markAllRead, markIdsRead, markOneRead };
}
