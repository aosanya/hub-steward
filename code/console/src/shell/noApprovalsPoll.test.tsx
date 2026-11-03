import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(async () => ({ items: [] })) }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const lab: Hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner", kind: "community computer lab", model_key_set: true };

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([lab]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(callTool).mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the console of a lab", () => {
  it("never asks for the approvals list on its own, however long it stays open", async () => {
    render(
      <MemoryRouter initialEntries={["/h/siaya/status"]}>
        <I18nProvider initial={words}>
          <SessionProvider>
            <Seed>
              <Routes>
                <Route path="/h/:hubId" element={<Frame />}>
                  <Route path="status" element={<h1>Status</h1>} />
                </Route>
              </Routes>
            </Seed>
          </SessionProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });

    expect(toolsCalled()).not.toContain("agency_list_approvals");
  });
});
