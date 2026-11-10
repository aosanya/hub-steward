import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { forgetConversations } from "./assistant/session";
import { rememberSide } from "./tabs";
import { setRuntimeConfig } from "./wakala/config";

beforeEach(() => {
  forgetConversations();
  rememberSide("start");
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
