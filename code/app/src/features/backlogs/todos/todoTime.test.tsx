import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todoOf } from "./api";
import { TodoTime } from "./TodoTime";
import type { Todo } from "./todoTree";

const todo = (over: Partial<Todo> = {}): Todo => ({ id: "t1", number: 1, title: "Piece", description: "", status: "pending", waitsOn: [], blockedReason: "", ...over });

const minute = 60_000;

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

describe("the time bubble of a todo", () => {
  it("shows nothing for a piece that has not been started", () => {
    const { container } = render(<TodoTime todo={todo()} />);
    expect(container.textContent).toBe("");
  });

  it("shows the minutes of a running piece in a plain chip", () => {
    render(<TodoTime todo={todo({ status: "dispatched", elapsedSeconds: 5 * 60 })} />);
    expect(screen.getByText("5 min").className).toBe("chip");
  });

  it("counts up once a minute while the piece runs", () => {
    render(<TodoTime todo={todo({ status: "dispatched", elapsedSeconds: 59 * 60 })} />);
    expect(screen.getByText("59 min")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(minute);
    });
    expect(screen.getByText("1 h")).toBeInTheDocument();
  });

  it("starts again from the new value when the piece is read again", () => {
    const { rerender } = render(<TodoTime todo={todo({ status: "dispatched", elapsedSeconds: 10 * 60 })} />);
    act(() => {
      vi.advanceTimersByTime(3 * minute);
    });
    expect(screen.getByText("13 min")).toBeInTheDocument();
    rerender(<TodoTime todo={todo({ status: "dispatched", elapsedSeconds: 20 * 60 })} />);
    expect(screen.getByText("20 min")).toBeInTheDocument();
  });

  it("keeps a Done piece at its fixed time", () => {
    render(<TodoTime todo={todo({ status: "completed", doneAt: "2026-11-17T09:00:00Z", elapsedSeconds: 2 * 3600 })} />);
    expect(screen.getByText("2 h")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(30 * minute);
    });
    expect(screen.getByText("2 h")).toBeInTheDocument();
  });

  it("shows a piece done without a done time at its fixed time", () => {
    render(<TodoTime todo={todo({ status: "completed", elapsedSeconds: 7 * 60 })} />);
    act(() => {
      vi.advanceTimersByTime(10 * minute);
    });
    expect(screen.getByText("7 min")).toBeInTheDocument();
  });

  it("shows days for a long time such as 26 hours", () => {
    render(<TodoTime todo={todo({ status: "completed", doneAt: "2026-11-17T09:00:00Z", elapsedSeconds: 26 * 3600 })} />);
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("stops its timer when the row goes away", () => {
    const { unmount } = render(<TodoTime todo={todo({ status: "dispatched", elapsedSeconds: 60 })} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sets no timer for a piece that is not running", () => {
    render(<TodoTime todo={todo({ status: "completed", doneAt: "2026-11-17T09:00:00Z", elapsedSeconds: 3600 })} />);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("reading the time of a todo", () => {
  it("takes elapsed_seconds and done_at from the reply", () => {
    const read = todoOf({ id: "a", ordinality: 1, status: "completed", done_at: "2026-11-17T09:00:00Z", elapsed_seconds: 90 });
    expect(read.elapsedSeconds).toBe(90);
    expect(read.doneAt).toBe("2026-11-17T09:00:00Z");
  });

  it("leaves both absent when the piece was not started", () => {
    const read = todoOf({ id: "a", ordinality: 1, status: "pending" });
    expect(read.elapsedSeconds).toBeUndefined();
    expect(read.doneAt).toBeUndefined();
  });

  it("ignores an elapsed value that is not a number", () => {
    expect(todoOf({ id: "a", elapsed_seconds: "soon" }).elapsedSeconds).toBeUndefined();
  });
});
