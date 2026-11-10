import { beforeEach, describe, expect, it, vi } from "vitest";

const pageModule = vi.fn();
vi.mock("../../data/registry", () => ({ pageModule: (page: string) => pageModule(page) }));

import { rowsOf } from "./usersLoad";

describe("rowsOf", () => {
  beforeEach(() => pageModule.mockReset());

  it("asks the page's module for the hub's rows with the query", async () => {
    const rows = vi.fn().mockResolvedValue([{ id: "1" }]);
    pageModule.mockReturnValue({ rows });
    await expect(rowsOf("users", "h1", { search: "ama" } as never)).resolves.toEqual([{ id: "1" }]);
    expect(pageModule).toHaveBeenCalledWith("users");
    expect(rows).toHaveBeenCalledWith("h1", { search: "ama" });
  });

  it("asks with an empty query when none is given", async () => {
    const rows = vi.fn().mockResolvedValue([]);
    pageModule.mockReturnValue({ rows });
    await rowsOf("users", "h1");
    expect(rows).toHaveBeenCalledWith("h1", {});
  });

  it("refuses a page that has no module and names the page", async () => {
    pageModule.mockReturnValue(undefined);
    await expect(rowsOf("nowhere", "h1")).rejects.toThrow("no module for the page nowhere");
  });
});
