import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { forgetConversations } from "./assistant/session";
import { mcpAssignedClient } from "./inbox/assignedIssues";
import { forgetSent } from "./steps/sent";
import { rememberSide } from "./tabs";
import { setRuntimeConfig } from "./wakala/config";

beforeEach(() => {
  vi.spyOn(mcpAssignedClient, "assigned").mockRejectedValue(new Error("issues unavailable"));
  window.localStorage.clear();
  forgetSent();
  forgetConversations();
  rememberSide("start");
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
