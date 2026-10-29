import { useCallback, useEffect, useRef, useState } from "react";

export const ROSTER_PAGE_SIZE = 50;

export type RosterPage<T> = { items: T[]; next?: string };

export type RosterLoad<T> = (limit: number, afterKey: string, term: string) => Promise<RosterPage<T>>;

export type RosterState<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
  more: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  showMore: () => void;
};

type Options<T> = { load: RosterLoad<T>; pageSize?: number; term?: string };

export const pageByKey = <T,>(items: T[], limit: number, keyOf: (item: T) => string): RosterPage<T> => ({
  items,
  next: items.length >= limit && items.length > 0 ? keyOf(items[items.length - 1]) : undefined,
});

export const loadFromList =
  <T,>(all: T[], keyOf: (item: T) => string): RosterLoad<T> =>
  async (limit, afterKey) => {
    const start = afterKey ? all.findIndex((item) => keyOf(item) === afterKey) + 1 : 0;
    return pageByKey(all.slice(start, start + limit), limit, keyOf);
  };

export function usePagedRoster<T>({ load, pageSize = ROSTER_PAGE_SIZE, term = "" }: Options<T>): RosterState<T> {
  const [status, setStatus] = useState<RosterState<T>["status"]>("loading");
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const generation = useRef(0);
  const fetching = useRef(false);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    const mine = ++generation.current;
    setStatus("loading");
    setItems([]);
    setNext(undefined);
    setLoadingMore(false);
    setMoreFailed(false);
    fetching.current = false;
    latest.current(pageSize, "", term).then(
      (page) => {
        if (mine !== generation.current) return;
        setItems(page.items);
        setNext(page.items.length > 0 ? page.next : undefined);
        setStatus("ready");
      },
      () => {
        if (mine === generation.current) setStatus("error");
      },
    );
    return () => {
      generation.current++;
    };
  }, [pageSize, term]);

  const showMore = useCallback(() => {
    if (next === undefined || fetching.current) return;
    fetching.current = true;
    const mine = generation.current;
    setLoadingMore(true);
    setMoreFailed(false);
    latest.current(pageSize, next, term).then(
      (page) => {
        if (mine !== generation.current) return;
        fetching.current = false;
        setItems((have) => [...have, ...page.items]);
        setNext(page.items.length > 0 ? page.next : undefined);
        setLoadingMore(false);
      },
      () => {
        if (mine !== generation.current) return;
        fetching.current = false;
        setLoadingMore(false);
        setMoreFailed(true);
      },
    );
  }, [next, pageSize, term]);

  return { status, items, more: next !== undefined, loadingMore, moreFailed, showMore };
}
