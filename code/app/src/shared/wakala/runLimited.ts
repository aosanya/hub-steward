const workersFor = (limit: number, count: number) => Math.min(Math.max(1, Math.floor(limit) || 1), count);

export const runLimited = async <T,>(items: T[], limit: number, run: (item: T) => Promise<unknown>, signal?: AbortSignal): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const item = items[next];
      next += 1;
      try {
        await run(item);
      } catch {
        continue;
      }
    }
  };
  await Promise.all(Array.from({ length: workersFor(limit, items.length) }, worker));
};
