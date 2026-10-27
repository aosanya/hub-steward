import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { setRuntimeConfig } from "./wakala/config";

beforeEach(() => {
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
