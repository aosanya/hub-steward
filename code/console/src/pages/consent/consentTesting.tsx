import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import { NoticeCtx } from "../../ui";
import { owner } from "../limits/harness";
import { LocationSpy } from "../models/locationSpy";
import { ConsentNewPage } from "./ConsentNewPage";
import { ConsentPage } from "./ConsentPage";

export { settle } from "../limits/harness";

function Stage() {
  const notice = useNoticeState(owner.id);
  return (
    <ConsoleCtx.Provider value={{ hub: owner, page: "consent", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>
        <Routes>
          <Route path="/h/:hubId/consent" element={<ConsentPage />} />
          <Route path="/h/:hubId/consent/new" element={<ConsentNewPage />} />
        </Routes>
        <LocationSpy />
      </NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export const renderConsentAt = (path: string) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[path]}>
        <Stage />
      </MemoryRouter>
    </I18nProvider>,
  );
