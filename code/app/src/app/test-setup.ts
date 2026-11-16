import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { forgetConversations } from "../features/assistant/session";
import { mcpAssignedClient } from "../features/inbox/assignedIssues";
import { forgetSent } from "../features/steps/sent";
import { rememberSide } from "./tabs";
import { setRuntimeConfig } from "../shared/wakala/config";

beforeEach(() => {
  vi.spyOn(mcpAssignedClient, "assigned").mockResolvedValue([]);
  window.localStorage.clear();
  forgetSent();
  forgetConversations();
  rememberSide("start");
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});
