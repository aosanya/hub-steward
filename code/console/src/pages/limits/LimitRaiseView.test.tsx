import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { callTool } from "../../wakala/mcp";
import { LimitRaiseView } from "./LimitRaiseView";

vi.mock("../../wakala/mcp");

const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const nineLimits = {
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_week: null,
  tokens_per_month: 4000000,
  requests_per_minute: 30,
  requests_per_day: 1500,
  requests_per_week: null,
  tokens_per_test: 30000,
  scenarios_at_once: 2,
};

const model = { id: "c1", name: "Meta Model API", model_name: "Muse Spark 1.3", ...nineLimits };

const farmers = { id: "r1", name: "Farmers' agent", account_id: "c1", ...nineLimits, tokens_per_day: 100000 };

const refusedMonth = { limit: "tokens_per_month", owner: "account", id: "c1", max: 4000000, used: 4000000, value: 6000000 };

const shown = vi.fn();
const done = vi.fn();

const answers = (replies: Record<string, unknown> = {}) => {
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
    if (tool === "ai_get_account") return model as never;
    if (tool === "ai_get_role") return farmers as never;
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return (reply ?? {}) as never;
  });
};

const sent = (tool: string) => vi.mocked(callTool).mock.calls.filter((call) => call[1] === tool);

const open = (params: Record<string, unknown>) =>
  render(
    <I18nProvider initial={words}>
      <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
        <NoticeCtx.Provider value={{ message: null, show: shown, dismiss: () => {} }}>
          <LimitRaiseView hubId={hub.id} title="" params={params} onDone={done} />
        </NoticeCtx.Provider>
      </ConsoleCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  shown.mockReset();
  done.mockReset();
  answers();
});

describe("the card that raises the limit which stopped a call", () => {
  it("says what it raises and to what, how far the limit has gone and what runs on approval", async () => {
    open(refusedMonth);
    expect(await screen.findByText("Raise Tokens per month to 6,000,000")).toBeInTheDocument();
    expect(screen.getByText("Meta Model API allows 4,000,000 and 4,000,000 of it is used. Runs ai_set_limits when you approve.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("records nothing while the card waits", async () => {
    open(refusedMonth);
    await screen.findByRole("button", { name: "Approve" });
    expect(sent("ai_set_limits")).toEqual([]);
    expect(sent("ai_set_role_limits")).toEqual([]);
  });

  it("raises the account's limit on Approve with all nine limits, then says so and closes", async () => {
    open(refusedMonth);
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent("ai_set_limits")).toHaveLength(1);
    expect(sent("ai_set_limits")[0][2]).toEqual({ accountID: "c1", ...nineLimits, tokens_per_month: 6000000 });
    expect(shown).toHaveBeenCalledWith("The limits were saved.");
  });

  it("raises a role's limit on Approve with ai_set_role_limits and all nine limits", async () => {
    open({ limit: "tokens_per_day", owner: "role", id: "r1", max: 100000, used: 100000, value: 150000 });
    expect(await screen.findByText("Farmers' agent allows 100,000 and 100,000 of it is used. Runs ai_set_role_limits when you approve.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent("ai_set_role_limits")).toHaveLength(1);
    expect(sent("ai_set_role_limits")[0][2]).toEqual({ roleID: "r1", ...nineLimits, tokens_per_day: 150000 });
    expect(sent("ai_set_limits")).toEqual([]);
  });

  it("records nothing and closes on Decline", async () => {
    open(refusedMonth);
    await userEvent.click(await screen.findByRole("button", { name: "Decline" }));
    expect(done).toHaveBeenCalled();
    expect(sent("ai_set_limits")).toEqual([]);
  });

  it("stays open and shows the refusal when the raise is not accepted", async () => {
    answers({ ai_set_limits: new Error("a limit cannot be below zero") });
    open(refusedMonth);
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(shown).toHaveBeenCalledWith("a limit cannot be below zero", "bad"));
    expect(done).not.toHaveBeenCalled();
  });

  it("says it could not be loaded when the holder cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("gone"));
    open(refusedMonth);
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("says it could not be loaded, and reads nothing, when the model gave a raise that is no raise", async () => {
    open({ ...refusedMonth, value: 1000 });
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
    expect(vi.mocked(callTool)).not.toHaveBeenCalled();
  });
});

describe("the card that raises a limit holds to what the person approved", () => {
  const holding = (now: () => Record<string, unknown>, set: (args: unknown) => Promise<unknown> = async () => ({})) =>
    vi.mocked(callTool).mockImplementation(async (_hub, tool, args) => {
      if (tool === "ai_get_account") return now() as never;
      if (tool === "ai_set_limits") return (await set(args)) as never;
      return {} as never;
    });

  it("reads the account again on Approve and writes the limits it holds then, with only the raised one changed", async () => {
    let held: Record<string, unknown> = model;
    holding(() => held);
    open(refusedMonth);
    await screen.findByRole("button", { name: "Approve" });
    held = { ...model, requests_per_minute: 5, tokens_per_call: 123 };
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent("ai_set_limits")[0][2]).toEqual({ accountID: "c1", ...nineLimits, requests_per_minute: 5, tokens_per_call: 123, tokens_per_month: 6000000 });
  });

  it("will not draw a raise that would lower the limit the account holds, whatever maximum the model quoted", async () => {
    holding(() => ({ ...model, tokens_per_month: 9000000 }));
    open(refusedMonth);
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
    expect(sent("ai_set_limits")).toEqual([]);
  });

  it("refuses on Approve, writing nothing, when the limit was raised past the ask after the card drew", async () => {
    let held: Record<string, unknown> = model;
    holding(() => held);
    open(refusedMonth);
    await screen.findByRole("button", { name: "Approve" });
    held = { ...model, tokens_per_month: 7000000 };
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(shown).toHaveBeenCalledWith("that is not higher than the limit now", "bad"));
    expect(sent("ai_set_limits")).toEqual([]);
    expect(done).not.toHaveBeenCalled();
  });

  it("holds both buttons while Approve is writing, and closes once", async () => {
    let finish: () => void = () => {};
    holding(() => model, () => new Promise((resolve) => (finish = () => resolve({}))));
    open(refusedMonth);
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    finish();
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  });

  it("does not close the card that replaced it when its own late write lands", async () => {
    let finish: () => void = () => {};
    holding(() => model, () => new Promise((resolve) => (finish = () => resolve({}))));
    const view = (params: Record<string, unknown>) => (
      <I18nProvider initial={words}>
        <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
          <NoticeCtx.Provider value={{ message: null, show: shown, dismiss: () => {} }}>
            <LimitRaiseView hubId={hub.id} title="" params={params} onDone={done} />
          </NoticeCtx.Provider>
        </ConsoleCtx.Provider>
      </I18nProvider>
    );
    const { rerender } = render(view(refusedMonth));
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    rerender(view({ ...refusedMonth, value: 7000000 }));
    expect(await screen.findByText("Raise Tokens per month to 7,000,000")).toBeInTheDocument();
    finish();
    await waitFor(() => expect(shown).toHaveBeenCalledWith("The limits were saved."));
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });
});

describe("the words of the raise card", () => {
  const languages = Object.keys(words) as (keyof typeof words)[];
  const table = (language: keyof typeof words) => words[language] as Record<string, string>;

  it.each(languages)("has a title and a sentence that keep their five blanks in %s", (language) => {
    const title = table(language)["limitRaise.title"];
    const sentence = table(language)["limitRaise.text"];
    for (const blank of ["{limit}", "{value}"]) expect(title, `${language} title ${blank}`).toContain(blank);
    for (const blank of ["{name}", "{max}", "{used}", "{tool}"]) expect(sentence, `${language} text ${blank}`).toContain(blank);
  });
});
