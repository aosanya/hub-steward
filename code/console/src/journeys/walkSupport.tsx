import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { PublishView } from "../pages/views/PublishView";
import { RolesView } from "../pages/views/RolesView";
import { TestView } from "../pages/views/TestView";
import { WorkflowsView } from "../pages/views/WorkflowsView";
import { WorkflowEdit } from "../pages/workflows/WorkflowEdit";
import { Frame } from "../shell/Frame";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";

export const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

export const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

function Seed({ hub, children }: { hub: Hub; children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([hub]);
    setReady(true);
  }, [hub, startSession]);
  return ready ? <>{children}</> : null;
}

export const mountConsole = (hub: Hub = siaya) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      const data = path === "/instances" ? [{ id: hub.id, name: hub.name, role: "owner", kind: hub.kind }] : {};
      return { ok: true, status: 200, json: async () => data };
    }),
  );
  return render(
    <MemoryRouter initialEntries={[`/h/${hub.id}/status`]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed hub={hub}>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="status" element={<h1>Status</h1>} />
                <Route path="roles" element={<RolesView />} />
                <Route path="workflows" element={<WorkflowsView />} />
                <Route path="workflow-edit/:id/:tab" element={<WorkflowEdit />} />
                <Route path="test" element={<TestView />} />
                <Route path="publish" element={<PublishView />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

export const user = userEvent.setup();

export const main = () => within(document.querySelector("main") as HTMLElement);
export const chat = () => within(screen.getByRole("complementary", { name: "Chat" }));
export const cards = () => [...document.querySelectorAll<HTMLElement>("main .card")];
export const cardNamed = (name: string) => cards().find((card) => within(card).queryByText(name) !== null)!;
export const cardShown = (name: string) => waitFor(() => expect(cards().some((card) => within(card).queryByText(name) !== null)).toBe(true));
export const pairsOf = (root: HTMLElement) =>
  Object.fromEntries([...root.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent ?? ""]));
export const chipsOf = (root: HTMLElement) => [...root.querySelectorAll(".tag")].map((chip) => chip.textContent);
export const heading = (name: string, level = 1) => screen.findByRole("heading", { level, name });

export const goTo = async (page: string) => {
  await user.click(within(screen.getByRole("navigation", { name: "Menu" })).getByRole("link", { name: new RegExp("^" + page) }));
  await heading(page);
};
