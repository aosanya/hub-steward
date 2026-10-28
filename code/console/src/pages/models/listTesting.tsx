import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import words from "../../../public/i18n.json";
import { accountUsers, ensureDefaultAccount, listAccounts, type Account, type AccountUser } from "../../data/accounts";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { LocationSpy } from "./locationSpy";

export const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const account = (fields: Partial<Account>): Account => ({
  id: "",
  name: "",
  provider: "openai_compatible",
  baseUrl: "",
  modelName: "",
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: false,
  chatLabel: "",
  ...fields,
});

export const glm = account({
  id: "a1",
  name: "Hugging Face · GLM-5.3",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
});

export const sonnet = account({
  id: "a2",
  name: "Claude · Sonnet 5.5",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  keySet: false,
});

export const agentNamed = (name: string): AccountUser => ({ id: name.toLowerCase(), name, description: "" });

export type Held = { accounts: Account[]; users?: Record<string, AccountUser[]> };

export function stubAccounts(first: Held, ...later: Held[]) {
  const rounds = [first, ...later];
  let round = 0;
  let current = first;
  vi.mocked(listAccounts).mockImplementation(async () => {
    current = rounds[Math.min(round++, rounds.length - 1)];
    return current.accounts;
  });
  vi.mocked(ensureDefaultAccount).mockImplementation(async (_hubId, listed) => listed);
  vi.mocked(accountUsers).mockImplementation(async (_hubId, accountId) => current.users?.[accountId] ?? []);
}

function Stage({ children }: { children: ReactNode }) {
  const notice = useNoticeState(hub.id);
  return (
    <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>{children}</NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export function renderOnStage(page: ReactNode, at = "/h/h1/models") {
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[at]}>
        <LocationSpy />
        <Stage>{page}</Stage>
      </MemoryRouter>
    </I18nProvider>,
  );
}

export const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 6; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
