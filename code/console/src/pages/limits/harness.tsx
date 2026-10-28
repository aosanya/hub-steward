import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import words from "../../../public/i18n.json";
import { listAccounts, type Account } from "../../data/accounts";
import { heldLimitKeys, modelAccounts, type HeldLimits, type ModelAccount } from "../../data/modelLimits";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { LocationSpy } from "../models/locationSpy";
import { ModelPage } from "../models/ModelPage";

export const owner: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

export const staff: Hub = { ...owner, role: "agent" };

export const noLimits = Object.fromEntries(heldLimitKeys.map((key) => [key, null])) as HeldLimits;

export const glm: ModelAccount = {
  id: "c1",
  name: "main",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
  limits: {
    ...noLimits,
    tokens_per_call: 8000,
    tokens_per_day: 200000,
    tokens_per_month: 4000000,
    requests_per_minute: 30,
    requests_per_day: 1500,
    tokens_per_test: 30000,
    scenarios_at_once: 2,
  },
};

export const sonnet: ModelAccount = {
  id: "c2",
  name: "writer",
  baseUrl: "https://api.anthropic.com/v1",
  modelName: "claude-sonnet-5-5",
  limits: noLimits,
};

export const listedAs = (model: ModelAccount): Account => ({
  id: model.id,
  name: model.name,
  provider: model.baseUrl.includes("anthropic") ? "anthropic" : "openai_compatible",
  baseUrl: model.baseUrl,
  modelName: model.modelName,
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: true,
  chatLabel: "",
});

function Stage({ hub, children }: { hub: Hub; children: ReactNode }) {
  const notice = useNoticeState(hub.id);
  return (
    <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>{children}</NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export function renderOnPage(page: ReactNode, hub: Hub = owner) {
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter>
        <Stage hub={hub}>{page}</Stage>
      </MemoryRouter>
    </I18nProvider>,
  );
}

export function renderModelAt(path: string, hub: Hub = owner) {
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/h/:hubId/models" element={<LocationSpy />} />
          <Route path="/h/:hubId/models/:accountId" element={<Navigate to="key" replace />} />
          <Route
            path="/h/:hubId/models/:accountId/:tab"
            element={
              <Stage hub={hub}>
                <ModelPage />
                <LocationSpy />
              </Stage>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

export const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 6; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

export async function openModel(models: ModelAccount[] | Error, tab: string, hub: Hub = owner, id: string = glm.id) {
  vi.mocked(modelAccounts).mockReset();
  vi.mocked(listAccounts).mockReset();
  if (models instanceof Error) {
    vi.mocked(modelAccounts).mockRejectedValue(models);
    vi.mocked(listAccounts).mockRejectedValue(models);
  } else {
    vi.mocked(modelAccounts).mockResolvedValue(models);
    vi.mocked(listAccounts).mockResolvedValue(models.map(listedAs));
  }
  renderModelAt("/h/" + hub.id + "/models/" + encodeURIComponent(id) + "/" + tab, hub);
  await settle();
}
