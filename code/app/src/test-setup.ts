import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { forgetConversations } from "./assistant/session";
import { forgetSent } from "./steps/sent";
import { rememberSide } from "./tabs";
import { setRuntimeConfig } from "./wakala/config";

beforeEach(() => {
  window.localStorage.clear();
  forgetSent();
  forgetConversations();
  rememberSide("start");
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
