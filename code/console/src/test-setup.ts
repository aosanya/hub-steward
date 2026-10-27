import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { setRuntimeConfig } from "./wakala/config";

vi.mock("./data/accountModels", () => ({ keyModels: vi.fn(() => Promise.reject(new Error("the provider was not reached"))) }));

beforeEach(() => {
  window.localStorage.clear();
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
