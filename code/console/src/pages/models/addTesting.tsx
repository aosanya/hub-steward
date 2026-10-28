import type { ReactNode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import words from "../../../public/i18n.json";
import * as accounts from "../../data/accounts";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { LocationSpy } from "./locationSpy";
import { ModelAdd } from "./ModelAdd";
import { ModelAddPage } from "./ModelAddPage";
import type { AddStart } from "./catalog";

export const hub: Hub = { id: "hub-a", name: "Siaya Farmers' Group", role: "owner" };

export const secret = "sk-ant-api03-very-secret-value";

export const labelled = (name: string) => new RegExp(`^${name}\\*?$`);

export const accountOf = (fields: Partial<accounts.Account> = {}): accounts.Account => ({
  id: "acc-1",
  name: "Claude · Sonnet 5.5",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  status: "enabled",
  keySet: false,
  lastTestResult: "",
  lastTestedAt: "",
  chatEnabled: true,
  chatLabel: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  ...fields,
});

export type TestOutcome = accounts.TestResult;

export const outcomeOf = (fields: Partial<TestOutcome> = {}): TestOutcome => ({
  working: true,
  reason: "",
  tookMs: 320,
  prompt: "Reply with the single word OK",
  reply: "OK",
  ...fields,
});

export type Replies = {
  listAccounts?: accounts.Account[] | Error;
  createAccount?: accounts.Account | Error;
  setAccountKey?: accounts.Account | Error | (accounts.Account | Error)[];
  testAccount?: TestOutcome | Error;
};

export type Call = { fn: "listAccounts" | "createAccount" | "setAccountKey" | "testAccount"; args: unknown[] };

const answer = <T,>(reply: T | Error): Promise<T> => (reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply));

export function stubAccounts(replies: Replies = {}) {
  const calls: Call[] = [];
  const created = replies.createAccount instanceof Error ? accountOf() : (replies.createAccount ?? accountOf());
  const keyReplies = [replies.setAccountKey ?? []].flat();
  const record = (fn: Call["fn"], args: unknown[]) => calls.push({ fn, args });
  vi.mocked(accounts.listAccounts).mockImplementation((...args) => {
    record("listAccounts", args);
    return answer(replies.listAccounts ?? []);
  });
  vi.mocked(accounts.createAccount).mockImplementation((...args) => {
    record("createAccount", args);
    return answer(replies.createAccount ?? created);
  });
  vi.mocked(accounts.setAccountKey).mockImplementation((...args) => {
    record("setAccountKey", args);
    return answer(keyReplies.shift() ?? { ...created, keySet: true });
  });
  vi.mocked(accounts.testAccount).mockImplementation((...args) => {
    record("testAccount", args);
    return answer(replies.testAccount ?? outcomeOf());
  });
  return calls;
}

export const callsTo = (calls: Call[], fn: Call["fn"]) => calls.filter((call) => call.fn === fn);

function Stage({ children }: { children: ReactNode }) {
  const notice = useNoticeState(hub.id);
  return (
    <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>{children}</NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export function renderAdd(props: { onBack?: () => void; start?: AddStart } = {}) {
  const onBack = props.onBack ?? (() => {});
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter>
        <Stage>
          <ModelAdd onBack={onBack} start={props.start} />
        </Stage>
      </MemoryRouter>
    </I18nProvider>,
  );
}

export function renderAddPage(at = "/h/hub-a/models/new") {
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[at]}>
        <LocationSpy />
        <Stage>
          <ModelAddPage />
        </Stage>
      </MemoryRouter>
    </I18nProvider>,
  );
}

export const optionsOf = (label: string) =>
  within(screen.getByLabelText(labelled(label)))
    .getAllByRole("option")
    .map((option) => option.textContent);

export const choose = async (provider: string, model?: string) => {
  await userEvent.selectOptions(screen.getByLabelText(labelled("Provider")), provider);
  if (model !== undefined) await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), model);
};

export const typeInto = async (label: string | RegExp, text: string) => {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, text);
};

export const press = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const fieldsHold = (text: string) =>
  [...document.querySelectorAll<HTMLInputElement>("input, textarea, select")].some((field) => field.value.includes(text));

export const pageHolds = (text: string) => fieldsHold(text) || document.documentElement.outerHTML.includes(text);

export const settled = () => act(async () => {});
