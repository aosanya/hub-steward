import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { setRuntimeConfig } from "./wakala/config";

vi.mock("./data/accountModels", () => ({ keyModels: vi.fn(() => Promise.reject(new Error("the provider was not reached"))) }));

vi.mock("./data/groups", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMyGroups: () => Promise.resolve({ groups: [{ id: "everyone", name: "Everyone", roles: [] }], assumedId: "everyone" }),
  assumeGroup: () => Promise.resolve(),
}));

beforeEach(() => {
  window.localStorage.clear();
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
