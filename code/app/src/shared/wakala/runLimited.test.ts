import { describe, expect, it } from "vitest";
import { runLimited } from "./runLimited";

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("running many jobs a few at a time", () => {
  it("never has more than the limit running at once", async () => {
    let running = 0;
    let most = 0;
    await runLimited(Array.from({ length: 25 }, (_, n) => n), 4, async () => {
      running += 1;
      most = Math.max(most, running);
      await later();
      running -= 1;
    });
    expect(most).toBe(4);
  });

  it("starts the jobs in the order given and runs every one once", async () => {
    const started: number[] = [];
    await runLimited([1, 2, 3, 4, 5, 6], 2, async (item) => {
      started.push(item);
      await later();
    });
    expect(started).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("goes on with the rest when one job fails", async () => {
    const done: number[] = [];
    await runLimited([1, 2, 3], 1, async (item) => {
      if (item === 2) throw new Error("boom");
      done.push(item);
    });
    expect(done).toEqual([1, 3]);
  });

  it("goes on with the rest when a job throws before it returns a promise", async () => {
    const done: number[] = [];
    await runLimited([1, 2, 3], 1, (item) => {
      if (item === 2) throw new Error("boom");
      done.push(item);
      return Promise.resolve();
    });
    expect(done).toEqual([1, 3]);
  });

  it.each([0, -3, Number.NaN])("still runs every job when the limit is %s", async (limit) => {
    const done: number[] = [];
    await runLimited([1, 2, 3], limit, async (item) => {
      done.push(item);
    });
    expect(done).toEqual([1, 2, 3]);
  });

  it("runs a fractional limit as its whole part", async () => {
    let running = 0;
    let most = 0;
    await runLimited([1, 2, 3, 4, 5, 6], 2.9, async () => {
      running += 1;
      most = Math.max(most, running);
      await later();
      running -= 1;
    });
    expect(most).toBe(2);
  });

  it("starts no job after the signal is aborted", async () => {
    const control = new AbortController();
    const started: number[] = [];
    await runLimited([1, 2, 3, 4], 1, async (item) => {
      started.push(item);
      if (item === 2) control.abort();
      await later();
    }, control.signal);
    expect(started).toEqual([1, 2]);
  });

  it("settles at once for no jobs", async () => {
    await expect(runLimited([], 4, async () => undefined)).resolves.toBeUndefined();
  });
});
