import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { hubPath } from "../../api";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";

const table = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

export const hubOf = (role: string) => ({ id: "h1", name: "Siaya Farmers' Group", role, model_key_set: true, manager_room_id: "room-m" });

export const wire = (day: string, over: Record<string, unknown> = {}) => ({
  day,
  model: "Muse Spark 1.3",
  role_id: "r1",
  role: "Farmers' agent",
  kind: "chat",
  person: "p1",
  tokens_in: 70,
  tokens_out: 30,
  requests: 2,
  ...over,
});

export const month = {
  window: "month",
  from: "2026-10-01",
  to: "2026-10-03",
  rows: [
    wire("2026-10-01"),
    wire("2026-10-02", { kind: "test_run", person: "p2", tokens_in: 160, tokens_out: 40, requests: 4 }),
    wire("2026-10-02", { role_id: "r2", role: "Suppliers' agent", model: "Muse Spark 1.2", person: "", kind: "background_job", tokens_in: 30, tokens_out: 20, requests: 1 }),
  ],
};

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function Frame({ role, children }: { role: string; children: ReactElement }) {
  const { page } = useParams();
  return (
    <ConsoleCtx.Provider value={{ hub: hubOf(role), page: page ?? "", setBadges: () => {}, refreshMenu: () => {} }}>
      {children}
      <Where />
    </ConsoleCtx.Provider>
  );
}

export function renderUsage(view: ReactElement, page: string, { role = "owner", search = "" } = {}) {
  render(
    <I18nProvider initial={{ en: table.en }}>
      <MemoryRouter future={routerFuture} initialEntries={[{ pathname: hubPath("h1", page), search }]}>
        <Routes>
          <Route path="/h/:hubId/:page" element={<Frame role={role}>{view}</Frame>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}
