import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workingDraftId } from "../../data/draft";
import { getReview, reviewPollMs, startReview } from "../../data/reviewApi";
import { finding, page, review, runningPage } from "./reviewFixtures";
import { useReview } from "./useReview";

vi.mock("../../data/draft", () => ({ workingDraftId: vi.fn() }));
vi.mock("../../data/reviewApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/reviewApi")>()),
  getReview: vi.fn(),
  startReview: vi.fn(),
}));

const settle = () => act(async () => {});

const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(reviewPollMs);
  });

const doneReview = () => page({ review: review({ id: "rv-1", status: "done" }) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(workingDraftId).mockReset().mockResolvedValue("d-1");
  vi.mocked(getReview).mockReset();
  vi.mocked(startReview).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loading the review of the working draft", () => {
  it("is ready with no page when the draft has no review yet", async () => {
    vi.mocked(getReview).mockResolvedValue(null);

    const { result } = renderHook(() => useReview("siaya"));
    expect(result.current.state).toBe("loading");
    await settle();

    expect(result.current.state).toBe("ready");
    expect(result.current.page).toBeNull();
    expect(getReview).toHaveBeenCalledWith("siaya", { draftId: "d-1" });
  });

  it("is ready with no page, and asks nothing, when the hub has no working draft", async () => {
    vi.mocked(workingDraftId).mockResolvedValue("");

    const { result } = renderHook(() => useReview("siaya"));
    await settle();

    expect(result.current.state).toBe("ready");
    expect(result.current.page).toBeNull();
    expect(getReview).not.toHaveBeenCalled();
  });

  it("fails with the sentence of the error", async () => {
    vi.mocked(getReview).mockRejectedValue(new Error("the hub is not reachable"));

    const { result } = renderHook(() => useReview("siaya"));
    await settle();

    expect(result.current.state).toBe("failed");
    expect(result.current.error).toBe("the hub is not reachable");
  });

  it("fails with a plain sentence when the error carries no message", async () => {
    vi.mocked(getReview).mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useReview("siaya"));
    await settle();

    expect(result.current.state).toBe("failed");
    expect(result.current.error).toBe("The review could not be loaded.");
  });

  it("does not poll a review that is already done", async () => {
    vi.mocked(getReview).mockResolvedValue(doneReview());

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    await tick();
    await tick();

    expect(result.current.page?.review.status).toBe("done");
    expect(getReview).toHaveBeenCalledTimes(1);
  });
});

describe("polling a running review", () => {
  it("reads the draft's review every poll interval and stops when it is done", async () => {
    vi.mocked(getReview)
      .mockResolvedValueOnce(runningPage(4))
      .mockResolvedValueOnce(runningPage(2))
      .mockResolvedValueOnce(doneReview());

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    expect(result.current.page?.review.status).toBe("running");
    expect(getReview).toHaveBeenCalledTimes(1);

    await tick();
    expect(getReview).toHaveBeenLastCalledWith("siaya", { draftId: "d-1" });
    expect(result.current.page?.review.status).toBe("running");

    await tick();
    expect(result.current.page?.review.status).toBe("done");
    expect(getReview).toHaveBeenCalledTimes(3);

    await tick();
    await tick();
    expect(getReview).toHaveBeenCalledTimes(3);
  });

  it("does not read before the poll interval has passed", async () => {
    vi.mocked(getReview).mockResolvedValue(runningPage(4));

    renderHook(() => useReview("siaya"));
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(reviewPollMs - 1);
    });

    expect(getReview).toHaveBeenCalledTimes(1);
  });

  it("keeps polling after one poll fails", async () => {
    vi.mocked(getReview)
      .mockResolvedValueOnce(runningPage(4))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(doneReview());

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    await tick();
    await tick();

    expect(result.current.page?.review.status).toBe("done");
    expect(result.current.state).toBe("ready");
    expect(result.current.error).toBe("");
  });

  it("stops polling when the component unmounts", async () => {
    vi.mocked(getReview).mockResolvedValue(runningPage(4));

    const { unmount } = renderHook(() => useReview("siaya"));
    await settle();
    expect(getReview).toHaveBeenCalledTimes(1);

    unmount();
    await tick();
    await tick();

    expect(getReview).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not update after unmount when a poll was still in flight", async () => {
    let finish!: (value: ReturnType<typeof doneReview>) => void;
    vi.mocked(getReview)
      .mockResolvedValueOnce(runningPage(4))
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    const { result, unmount } = renderHook(() => useReview("siaya"));
    await settle();
    await tick();
    unmount();
    await act(async () => finish(doneReview()));

    expect(result.current.page?.review.status).toBe("running");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resumes polling from the database when the page is mounted again", async () => {
    vi.mocked(getReview).mockResolvedValueOnce(runningPage(4)).mockResolvedValue(runningPage(3));

    const first = renderHook(() => useReview("siaya"));
    await settle();
    first.unmount();
    vi.mocked(getReview).mockClear();
    vi.mocked(getReview).mockResolvedValueOnce(runningPage(2)).mockResolvedValue(doneReview());

    const second = renderHook(() => useReview("siaya"));
    await settle();
    expect(second.result.current.page?.review.status).toBe("running");
    await tick();

    expect(getReview).toHaveBeenLastCalledWith("siaya", { draftId: "d-1" });
    expect(second.result.current.page?.review.status).toBe("done");
  });
});

describe("starting a review", () => {
  it("is starting while the call is in flight, then holds the running page and polls it", async () => {
    vi.mocked(getReview).mockResolvedValueOnce(null).mockResolvedValue(doneReview());
    let started!: (value: ReturnType<typeof runningPage>) => void;
    vi.mocked(startReview).mockImplementation(() => new Promise((resolve) => (started = resolve)));

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    expect(result.current.page).toBeNull();

    let call!: Promise<void>;
    await act(async () => {
      call = result.current.start();
    });
    expect(result.current.starting).toBe(true);
    expect(startReview).toHaveBeenCalledWith("siaya", "d-1", undefined);

    await act(async () => {
      started(runningPage(6));
      await call;
    });
    expect(result.current.starting).toBe(false);
    expect(result.current.page?.review.status).toBe("running");
    expect(result.current.error).toBe("");

    await tick();
    expect(getReview).toHaveBeenLastCalledWith("siaya", { draftId: "d-1" });
    expect(result.current.page?.review.status).toBe("done");
  });

  it("puts a refusal sentence in error and keeps the old page", async () => {
    const held = doneReview();
    vi.mocked(getReview).mockResolvedValue(held);
    vi.mocked(startReview).mockRejectedValue(new Error("A review of this draft is already running."));

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe("A review of this draft is already running.");
    expect(result.current.page).toEqual(held);
    expect(result.current.state).toBe("ready");
    expect(result.current.starting).toBe(false);
  });

  it("clears an earlier refusal when the next start goes through", async () => {
    vi.mocked(getReview).mockResolvedValue(null);
    vi.mocked(startReview)
      .mockRejectedValueOnce(new Error("A review of this draft is already running."))
      .mockResolvedValueOnce(doneReview());

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).not.toBe("");
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe("");
    expect(result.current.page?.review.status).toBe("done");
  });
});

describe("replacing a finding", () => {
  it("swaps only the finding with the same id and keeps everything else", async () => {
    const held = doneReview();
    vi.mocked(getReview).mockResolvedValue(held);

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    const changed = finding({ id: "f-2", title: "Give goal G-2 a number", status: "applied" });
    act(() => result.current.replaceFinding(changed));

    const goals = result.current.page!.areas[0].findings;
    expect(goals[0]).toEqual(held.areas[0].findings[0]);
    expect(goals[1]).toEqual(changed);
    expect(result.current.page!.areas.slice(1)).toEqual(held.areas.slice(1));
    expect(result.current.page!.review).toEqual(held.review);
  });

  it("changes nothing when no finding has that id", async () => {
    const held = doneReview();
    vi.mocked(getReview).mockResolvedValue(held);

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    act(() => result.current.replaceFinding(finding({ id: "f-9", status: "dismissed" })));

    expect(result.current.page).toEqual(held);
  });

  it("does nothing while there is no page", async () => {
    vi.mocked(getReview).mockResolvedValue(null);

    const { result } = renderHook(() => useReview("siaya"));
    await settle();
    act(() => result.current.replaceFinding(finding()));

    expect(result.current.page).toBeNull();
  });
});

describe("starting a review of one area", () => {
  it("passes the area to the run and watches the draft's latest result", async () => {
    vi.mocked(getReview).mockResolvedValue(null);
    vi.mocked(startReview).mockResolvedValue(runningPage(5));

    const { result } = renderHook(() => useReview("siaya", "goals"));
    await settle();
    await act(async () => {
      await result.current.start();
    });

    expect(startReview).toHaveBeenCalledWith("siaya", "d-1", "goals");
  });
});
