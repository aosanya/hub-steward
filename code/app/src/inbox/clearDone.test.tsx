import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "./api";
import { useClearDone } from "./clearDone";
import type { Reader } from "./subjectCheck";

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: "n1",
  event: "task_assigned",
  subjectKind: "task",
  subjectId: "t1",
  names: {},
  createdAt: "2026-11-12T10:00:00Z",
  read: false,
  ...over,
});

const statuses = (byId: Record<string, string>): Reader => vi.fn(async (_tool, args) => ({ status: byId[String(args.taskID)] }));

describe("a notification about a task that is done clears", () => {
  it("marks read the unread task notifications whose task is completed or cancelled", async () => {
    const markIdsRead = vi.fn().mockResolvedValue(true);
    const items = [
      note({ id: "n1", subjectId: "t1" }),
      note({ id: "n2", subjectId: "t2" }),
      note({ id: "n3", subjectId: "t3" }),
      note({ id: "n4", subjectId: "t4", read: true }),
    ];
    const read = statuses({ t1: "completed", t2: "pending", t3: "cancelled", t4: "completed" });
    renderHook(() => useClearDone(items, markIdsRead, read));
    await waitFor(() => expect(markIdsRead).toHaveBeenCalledWith(["n1", "n3"]));
    expect(read).not.toHaveBeenCalledWith("taskmanager_task_read", { taskID: "t4" });
  });

  it("leaves other events and other subjects alone", async () => {
    const markIdsRead = vi.fn().mockResolvedValue(true);
    const read = statuses({});
    renderHook(() => useClearDone([note({ event: "new_form", subjectKind: "form" }), note({ id: "n2", subjectKind: "group" })], markIdsRead, read));
    await new Promise((r) => setTimeout(r, 20));
    expect(read).not.toHaveBeenCalled();
    expect(markIdsRead).not.toHaveBeenCalled();
  });

  it("clears nothing when the read fails", async () => {
    const markIdsRead = vi.fn().mockResolvedValue(true);
    const read: Reader = vi.fn().mockRejectedValue(new Error("down"));
    renderHook(() => useClearDone([note({})], markIdsRead, read));
    await new Promise((r) => setTimeout(r, 20));
    expect(markIdsRead).not.toHaveBeenCalled();
  });

  it("checks each notification once, however often the list is read again", async () => {
    const markIdsRead = vi.fn().mockResolvedValue(true);
    const read = statuses({ t1: "pending" });
    const { rerender } = renderHook(({ items }) => useClearDone(items, markIdsRead, read), { initialProps: { items: [note({})] } });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    rerender({ items: [note({})] });
    await new Promise((r) => setTimeout(r, 20));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the list is not read yet", async () => {
    const markIdsRead = vi.fn();
    const read = statuses({});
    renderHook(() => useClearDone(null, markIdsRead, read));
    await new Promise((r) => setTimeout(r, 20));
    expect(read).not.toHaveBeenCalled();
  });
});
