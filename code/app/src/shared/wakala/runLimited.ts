export const runLimited = async <T,>(items: T[], limit: number, run: (item: T) => Promise<unknown>, signal?: AbortSignal): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const item = items[next];
      next += 1;
      await run(item).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};
