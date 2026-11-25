import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { file } from "./rulebookFixture";
import { useFileTarget } from "./useFileTarget";

beforeEach(() => openAgency("hub-1"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const folders = [
  { id: "r1", name: "hub-steward", branchId: "b1", changedAt: "" },
  { id: "r2", name: "wakala-api", branchId: "b2", changedAt: "" },
];

const clientOf = (read: () => Promise<typeof folders> = async () => folders) => ({ folders: vi.fn(read) });

const targetFor = async (client: ReturnType<typeof clientOf>, needed = true) => {
  const { result } = renderHook(() => useFileTarget(client, needed));
  if (needed) await waitFor(() => expect(client.folders).toHaveBeenCalled());
  return result;
};

describe("the Files address of a rule's file", () => {
  it("is the file screen of the folder named as the repository, on its default branch", async () => {
    const result = await targetFor(clientOf());
    await waitFor(() => expect(result.current(file({ repo: "hub-steward", path: "code/app/src/tokens.css" }))).toBe("/a/hub-1/files/r1/file?path=code%2Fapp%2Fsrc%2Ftokens.css"));
  });

  it("picks the right folder of two", async () => {
    const result = await targetFor(clientOf());
    await waitFor(() => expect(result.current(file({ repo: "wakala-api", path: "main.go" }))).toBe("/a/hub-1/files/r2/file?path=main.go"));
  });

  it("gives no address while the folders are still being read", async () => {
    const result = await targetFor(clientOf(() => new Promise(() => undefined)));
    expect(result.current(file({ repo: "hub-steward" }))).toBeUndefined();
  });

  it("gives no address when no folder carries the repository's name", async () => {
    const result = await targetFor(clientOf());
    await waitFor(() => expect(result.current(file({ repo: "hub-steward" }))).toBeDefined());
    expect(result.current(file({ repo: "elsewhere" }))).toBeUndefined();
  });

  it("gives no address for a file marked missing", async () => {
    const result = await targetFor(clientOf());
    await waitFor(() => expect(result.current(file({ repo: "hub-steward" }))).toBeDefined());
    expect(result.current(file({ repo: "hub-steward", missing: true }))).toBeUndefined();
  });

  it("gives no address when the folders cannot be read", async () => {
    const client = clientOf(async () => {
      throw new Error("403");
    });
    const result = await targetFor(client);
    expect(result.current(file({ repo: "hub-steward" }))).toBeUndefined();
  });

  it("reads the folders once for many files, and not at all when none is needed", async () => {
    const client = clientOf();
    const result = await targetFor(client);
    await waitFor(() => expect(result.current(file({ repo: "hub-steward" }))).toBeDefined());
    result.current(file({ repo: "wakala-api" }));
    result.current(file({ repo: "hub-steward", path: "x" }));
    expect(client.folders).toHaveBeenCalledTimes(1);
    const idle = clientOf();
    await targetFor(idle, false);
    expect(idle.folders).not.toHaveBeenCalled();
  });
});
