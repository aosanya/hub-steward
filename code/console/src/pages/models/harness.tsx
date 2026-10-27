import { useEffect, useState, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { SessionProvider, useSession } from "../../session";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";

export const hubWithoutKey: Hub = {
  id: "hub-a",
  name: "Siaya Farmers' Group",
  role: "manager",
  model_key_set: false,
};

export const hubWithKey: Hub = { ...hubWithoutKey, model_key_set: true };

export const claudeHub: Hub = { ...hubWithKey, id: "hub-c", name: "Riders" };

export const secondHub: Hub = { ...hubWithKey, id: "hub-b", name: "Kisumu Traders" };

export const labelled = (name: string) => new RegExp(`^${name}\\*?$`);

function Stage({ hubs, children }: { hubs: Hub[]; children: ReactNode }) {
  const { signedIn, hubs: live, startSession } = useSession();
  const [open, setOpen] = useState(0);

  useEffect(() => {
    startSession(hubs);
  }, []);

  const hub = live[open];
  const notice = useNoticeState(hub?.id ?? "");
  if (!signedIn || !hub) return null;
  return (
    <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>
        <button type="button" onClick={() => setOpen((open + 1) % live.length)}>
          Switch hub
        </button>
        {children}
      </NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export function renderOnStage(page: ReactNode, hubs: Hub[], at = "/") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Stage hubs={hubs}>{page}</Stage>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}
