import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotPublished } from "./useNotPublished";

const published = vi.hoisted(() => ({ lastPublished: vi.fn() }));

vi.mock("../../data/draft", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/draft")>()),
  lastPublished: published.lastPublished,
}));

beforeEach(() => {
  published.lastPublished.mockReset();
});

describe("the page a decided change still waits to be published on", () => {
  it("names the page when the change was decided after the last publication", async () => {
    published.lastPublished.mockResolvedValue({ version: 2, tag: "v2", at: "2026-10-30T10:00:00Z" });
    const { result } = renderHook(() => useNotPublished("h1", "agency_create_role", "approved", "2026-10-30T11:00:00Z"));
    await waitFor(() => expect(result.current).toBe("roles"));
    expect(published.lastPublished).toHaveBeenCalledWith("h1");
  });

  it("names the page when nothing was ever published", async () => {
    published.lastPublished.mockResolvedValue(null);
    const { result } = renderHook(() => useNotPublished("h1", "agency_create_goal", "approved", "2026-10-30T11:00:00Z"));
    await waitFor(() => expect(result.current).toBe("goals"));
  });

  it("names nothing when the change was decided before the last publication", async () => {
    published.lastPublished.mockResolvedValue({ version: 2, tag: "v2", at: "2026-10-30T12:00:00Z" });
    const { result } = renderHook(() => useNotPublished("h1", "agency_update_agency", "approved", "2026-10-30T11:00:00Z"));
    await waitFor(() => expect(published.lastPublished).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });

  it("does not ask the hub for a change that was not approved", () => {
    const { result } = renderHook(() => useNotPublished("h1", "agency_create_role", "rejected", "2026-10-30T11:00:00Z"));
    expect(result.current).toBeNull();
    expect(published.lastPublished).not.toHaveBeenCalled();
  });

  it("does not ask the hub for a kind of change that has no page", () => {
    const { result } = renderHook(() => useNotPublished("h1", "agency_delete_everything", "approved", "2026-10-30T11:00:00Z"));
    expect(result.current).toBeNull();
    expect(published.lastPublished).not.toHaveBeenCalled();
  });

  it("names nothing when the publications could not be read", async () => {
    published.lastPublished.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useNotPublished("h1", "agency_create_role", "approved", "2026-10-30T11:00:00Z"));
    await waitFor(() => expect(published.lastPublished).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });
});
