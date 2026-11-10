import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../i18n";
import { NoticeCtx, type NoticeApi } from "../../ui";

export { answering, clearPages, failing, installPage, pages } from "./testing";

export const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

export const shown: string[] = [];

const notices: NoticeApi = { message: null, show: (text, kind) => shown.push(`${kind}:${text}`), dismiss: () => {} };

export const clearShown = () => shown.splice(0, shown.length);

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

export function renderSpec(node: ReactNode, route = "/") {
  return render(
    <I18nProvider initial={words}>
      <NoticeCtx.Provider value={notices}>
        <MemoryRouter future={routerFuture} initialEntries={[route]}>
          {node}
        </MemoryRouter>
      </NoticeCtx.Provider>
    </I18nProvider>,
  );
}
