import { act, renderHook } from "@testing-library/react";
import { okNoticeLasts, useNoticeState } from "./useNoticeState";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const open = (hubId = "hub-a") => renderHook(({ id }) => useNoticeState(id), { initialProps: { id: hubId } });

describe("the notice a hub's pages share", () => {
  it("holds nothing until a message is shown", () => {
    const { result } = open();

    expect(result.current.message).toBeNull();
  });

  it("holds the message shown, as a success unless it says otherwise", () => {
    const { result } = open();

    act(() => result.current.show("Claude Sonnet 5.5 was added successfully."));

    expect(result.current.message).toMatchObject({ text: "Claude Sonnet 5.5 was added successfully.", kind: "ok" });
  });

  it("holds a failure as a failure", () => {
    const { result } = open();

    act(() => result.current.show("Could not add it.", "bad"));

    expect(result.current.message?.kind).toBe("bad");
  });

  it("replaces the older message with the newer one", () => {
    const { result } = open();
    act(() => result.current.show("first"));
    const first = result.current.message?.id;

    act(() => result.current.show("second"));

    expect(result.current.message?.text).toBe("second");
    expect(result.current.message?.id).not.toBe(first);
  });

  it("lets a success go by itself after six seconds", () => {
    const { result } = open();
    act(() => result.current.show("added"));

    act(() => vi.advanceTimersByTime(okNoticeLasts - 1));
    expect(result.current.message).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));

    expect(okNoticeLasts).toBe(6000);
    expect(result.current.message).toBeNull();
  });

  it("keeps a failure until it is dismissed", () => {
    const { result } = open();
    act(() => result.current.show("not added", "bad"));

    act(() => vi.advanceTimersByTime(okNoticeLasts * 10));
    expect(result.current.message?.text).toBe("not added");
    act(() => result.current.dismiss());

    expect(result.current.message).toBeNull();
  });

  it("starts the six seconds again when a newer success replaces an older one", () => {
    const { result } = open();
    act(() => result.current.show("first"));
    act(() => vi.advanceTimersByTime(okNoticeLasts - 1000));

    act(() => result.current.show("second"));
    act(() => vi.advanceTimersByTime(okNoticeLasts - 1000));

    expect(result.current.message?.text).toBe("second");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.message).toBeNull();
  });

  it("holds nothing once another hub is open", () => {
    const { result, rerender } = open("hub-a");
    act(() => result.current.show("added"));

    rerender({ id: "hub-b" });

    expect(result.current.message).toBeNull();
  });
});
