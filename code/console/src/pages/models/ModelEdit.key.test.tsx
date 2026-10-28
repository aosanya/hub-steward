import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Account } from "../../data/accounts";
import {
  answered,
  callsTo,
  claudeAccount,
  deferred,
  metaAccount,
  noticeShowing,
  opened,
  pageReady,
  refused,
  renderEdit,
  testedBefore,
  type Call,
} from "./editTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  getAccount: vi.fn(),
  listAccounts: vi.fn(),
  updateAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const secret = "sk-ant-never-to-be-shown-again";
const replaced = "The key for Claude Sonnet 5.5 was replaced.";

const keyField = () => screen.getByLabelText("Replace the key");
const typeKey = (value = secret) => userEvent.type(keyField(), value);
const save = () => screen.queryByRole("button", { name: "Save" });
const clickSave = () => userEvent.click(screen.getByRole("button", { name: "Save" }));
const chooseOpus = () => userEvent.selectOptions(screen.getByLabelText(/^Model\*?$/), "claude-opus-5-5");
const testConnection = () => userEvent.click(screen.getByRole("button", { name: "Test connection" }));
const order = (calls: Call[]) => calls.map((call) => call.fn);

describe("the one Save button, for the key alone", () => {
  it("is not on the page until a key is typed, and has Cancel beside it then", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    expect(save()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    await typeKey();

    expect(save()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Save key" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("does not count blanks as a typed key", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await userEvent.type(keyField(), "   ");

    expect(save()).not.toBeInTheDocument();
  });

  it("hides the typed key until it is asked to show it", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await typeKey();

    expect(keyField()).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(keyField()).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide key" }));
    expect(keyField()).toHaveAttribute("type", "password");
  });

  it("sends the key for this account only, says it was replaced in the bar under the title, and keeps nothing of the key", async () => {
    const calls = renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), setAccountKey: claudeAccount });
    await pageReady();
    await typeKey();
    await clickSave();

    const bar = await noticeShowing(replaced);
    expect(bar).toHaveClass("ok");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(callsTo(calls, "setAccountKey")[0].args).toEqual(["h1", "a2", secret]);
    expect(callsTo(calls, "updateAccount")).toHaveLength(0);
    await waitFor(() => expect(keyField()).toHaveValue(""));
    expect(document.body.innerHTML).not.toContain(secret);
    expect(save()).not.toBeInTheDocument();
  });

  it("draws no inline Saved line after the key is saved", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), setAccountKey: claudeAccount });
    await pageReady();
    await typeKey();
    await clickSave();
    await noticeShowing(replaced);

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getAllByText(/was replaced/)).toHaveLength(1);
  });

  it("names the model the way Add a model does, for a Meta Model API account", async () => {
    renderEdit("a1", { ...opened(metaAccount, [claudeAccount]), setAccountKey: metaAccount });
    await pageReady();
    await typeKey();
    await clickSave();

    expect(await noticeShowing("The key for Meta Model API Muse Spark 1.3 was replaced.")).toBeInTheDocument();
  });

  it("says the backend's sentence in a red bar when the key is refused, without the key in it", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), setAccountKey: new Error(`ai_set_account_key: the key ${secret} was too long`) });
    await pageReady();
    await typeKey();
    await clickSave();

    const bar = await screen.findByRole("alert");
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveTextContent("the key was too long");
    expect(bar.textContent).not.toContain(secret);
    expect(bar.textContent).not.toContain("ai_set_account_key");
    expect(screen.queryByText(/was replaced/)).not.toBeInTheDocument();
    expect(keyField()).toHaveValue(secret);
    expect(save()).toBeEnabled();
  });

  it("says the key could not be saved when the failure carries no sentence", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), setAccountKey: new Error("") });
    await pageReady();
    await typeKey();
    await clickSave();

    expect(await screen.findByRole("alert")).toHaveTextContent("The key could not be saved.");
  });

  it("clears the typed key and hides Save on Cancel", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await typeKey();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(keyField()).toHaveValue("");
    expect(save()).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(secret);
  });
});

describe("the one Save button, for the changes and the key together", () => {
  const both = (extra = {}) => renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), updateAccount: claudeAccount, setAccountKey: claudeAccount, ...extra });

  it("saves the changes first and then the key, and says the key was replaced", async () => {
    const calls = both();
    await pageReady();
    await chooseOpus();
    await typeKey();
    await clickSave();

    expect(await noticeShowing("The key for Claude Opus 5.5 was replaced.")).toHaveClass("ok");
    expect(order(calls).filter((fn) => fn === "updateAccount" || fn === "setAccountKey")).toEqual(["updateAccount", "setAccountKey"]);
    expect(callsTo(calls, "updateAccount")[0].args).toEqual(["h1", "a2", { modelName: "claude-opus-5-5", chatEnabled: false, chatLabel: "" }]);
    expect(callsTo(calls, "setAccountKey")[0].args).toEqual(["h1", "a2", secret]);
  });

  it("is one button for the chat checkbox and the name as well", async () => {
    const calls = both();
    await pageReady();
    await userEvent.click(screen.getByRole("checkbox", { name: "Can be used in the chat" }));
    await userEvent.type(screen.getByLabelText("Name in the chat"), "Careful");
    await typeKey();
    await clickSave();
    await noticeShowing(replaced);

    expect(callsTo(calls, "updateAccount")[0].args[2]).toEqual({ modelName: "claude-sonnet-5-5", chatEnabled: true, chatLabel: "Careful" });
    expect(callsTo(calls, "setAccountKey")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Save/ })).not.toBeInTheDocument();
  });

  it("does not send the key when the changes cannot be saved, and keeps both for the next try", async () => {
    const calls = both({ updateAccount: new Error("the hub has no other model for the chat") });
    await pageReady();
    await chooseOpus();
    await typeKey();
    await clickSave();

    const bar = await screen.findByRole("alert");
    expect(bar).toHaveTextContent("the hub has no other model for the chat");
    expect(callsTo(calls, "setAccountKey")).toHaveLength(0);
    expect(keyField()).toHaveValue(secret);
    expect(screen.getByLabelText(/^Model\*?$/)).toHaveValue("claude-opus-5-5");
    expect(save()).toBeEnabled();
  });

  it("keeps the saved changes and the typed key when only the key fails, and retries only the key", async () => {
    let tries = 0;
    const calls = both({ setAccountKey: () => (++tries === 1 ? new Error(`the model refused ${secret}`) : claudeAccount) });
    await pageReady();
    await chooseOpus();
    await typeKey();
    await clickSave();

    const bar = await screen.findByRole("alert");
    expect(bar).toHaveTextContent("the model refused");
    expect(bar.textContent).not.toContain(secret);
    expect(screen.getByLabelText(/^Model\*?$/)).toHaveValue("claude-opus-5-5");
    expect(keyField()).toHaveValue(secret);
    expect(callsTo(calls, "getAccount")).toHaveLength(1);

    await clickSave();

    expect(await noticeShowing("The key for Claude Opus 5.5 was replaced.")).toHaveClass("ok");
    expect(callsTo(calls, "updateAccount")).toHaveLength(1);
    expect(callsTo(calls, "setAccountKey")).toHaveLength(2);
    expect(document.body.innerHTML).not.toContain(secret);
  });

  it("restores the saved fields and clears the key on Cancel", async () => {
    both();
    await pageReady();
    await chooseOpus();
    await typeKey();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText(/^Model\*?$/)).toHaveValue("claude-sonnet-5-5");
    expect(keyField()).toHaveValue("");
    expect(save()).not.toBeInTheDocument();
  });

  it("keeps Save off while the typed model name is empty, even with a key typed", async () => {
    both();
    await pageReady();
    await userEvent.selectOptions(screen.getByLabelText(/^Model\*?$/), "other");
    await typeKey();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("reads the account again after the changes and the key are saved", async () => {
    const calls = both();
    await pageReady();
    await chooseOpus();
    await typeKey();
    await clickSave();
    await noticeShowing("The key for Claude Opus 5.5 was replaced.");

    await waitFor(() => expect(callsTo(calls, "getAccount")).toHaveLength(2));
  });
});

describe("Test connection and its log", () => {
  it("draws nothing for an account that was never tested", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the message going out while it waits, then what was sent, what answered and the time", async () => {
    const waiting = deferred<ReturnType<typeof answered>>();
    const calls = renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: () => waiting.promise });
    await pageReady();
    await testConnection();

    expect(screen.getByRole("status")).toHaveTextContent("Sending a short message to Claude…");
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();

    waiting.resolve(answered(640));

    expect(await screen.findByText("Sent: “Reply with the single word OK.”")).toBeInTheDocument();
    const line = screen.getByText("Answered: “OK” · 640 ms");
    expect(line.closest(".mk-result")).not.toHaveClass("bad");
    expect(screen.queryByText(/Sending a short message/)).not.toBeInTheDocument();
    expect(callsTo(calls, "testAccount")[0].args).toEqual(["h1", "a2", ""]);
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  });

  it("names Hugging Face while sending to an account on the Hugging Face address", async () => {
    const waiting = deferred<ReturnType<typeof answered>>();
    renderEdit("a3", {
      ...opened({ ...metaAccount, id: "a3", baseUrl: "https://router.huggingface.co/v1", modelName: "zai-org/GLM-5.3:novita" }, [claudeAccount]),
      testAccount: () => waiting.promise,
    });
    await pageReady();
    await testConnection();

    expect(screen.getByRole("status")).toHaveTextContent("Sending a short message to Hugging Face…");
  });

  it("says Not working with the plain reason, in red, with the time", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: refused("the model refused the key") });
    await pageReady();
    await testConnection();

    const line = await screen.findByText("Not working: the model refused the key · 80 ms");
    expect(line.closest(".mk-result")).toHaveClass("bad");
  });

  it("says Not working with the failure's sentence when the test could not be asked, without a time", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: new Error("ai_test_account: the test could not be started") });
    await pageReady();
    await testConnection();

    const line = await screen.findByText("Not working: the test could not be started");
    expect(line.closest(".mk-result")).toHaveClass("bad");
  });

  it("replaces the earlier result with the next one", async () => {
    let working = true;
    renderEdit("a2", {
      ...opened(claudeAccount, [metaAccount]),
      testAccount: () => (working ? answered(7) : refused("the model could not be reached", 9)),
    });
    await pageReady();
    await testConnection();
    await screen.findByText("Answered: “OK” · 7 ms");
    working = false;
    await testConnection();

    expect(await screen.findByText("Not working: the model could not be reached · 9 ms")).toBeInTheDocument();
    expect(screen.queryByText("Answered: “OK” · 7 ms")).not.toBeInTheDocument();
  });

  it("is off for an account that holds no key", async () => {
    renderEdit("a2", opened({ ...claudeAccount, keySet: false }, [metaAccount]));
    await pageReady();

    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });

  it("turns on once a key has been saved", async () => {
    let held: Account = { ...claudeAccount, keySet: false };
    renderEdit("a2", {
      getAccount: () => held,
      listAccounts: () => [held, metaAccount],
      setAccountKey: () => {
        held = { ...held, keySet: true };
        return held;
      },
    });
    await pageReady();
    await typeKey();
    await clickSave();
    await noticeShowing(replaced);

    await waitFor(() => expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled());
  });

  it("tests the key that was typed, not the saved one, and leaves it typed and unsaved", async () => {
    const calls = renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: answered(50) });
    await pageReady();
    await typeKey();
    await testConnection();

    expect(await screen.findByText("Answered: “OK” · 50 ms")).toBeInTheDocument();
    expect(callsTo(calls, "testAccount")[0].args).toEqual(["h1", "a2", secret]);
    expect(callsTo(calls, "setAccountKey")).toHaveLength(0);
    expect(keyField()).toHaveValue(secret);
    expect(save()).toBeEnabled();
  });

  it("tests the saved key again once the typed one is cancelled", async () => {
    const calls = renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: answered(50) });
    await pageReady();
    await typeKey();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await testConnection();

    await screen.findByText("Answered: “OK” · 50 ms");
    expect(callsTo(calls, "testAccount")[0].args).toEqual(["h1", "a2", ""]);
  });

  it("tests the key typed after earlier changes were saved, not the one saved before", async () => {
    const calls = renderEdit("a2", {
      ...opened(claudeAccount, [metaAccount]),
      updateAccount: claudeAccount,
      setAccountKey: claudeAccount,
      testAccount: answered(50),
    });
    await pageReady();
    await typeKey();
    await clickSave();
    await noticeShowing(replaced);
    await typeKey("sk-ant-a-newer-one");
    await testConnection();

    await screen.findByText("Answered: “OK” · 50 ms");
    expect(callsTo(calls, "testAccount")[0].args).toEqual(["h1", "a2", "sk-ant-a-newer-one"]);
  });

  it("is on for an account that holds no key as soon as one is typed, and off again when blanks are all there is", async () => {
    renderEdit("a2", opened({ ...claudeAccount, keySet: false }, [metaAccount]));
    await pageReady();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();

    await userEvent.type(keyField(), "   ");
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();

    await userEvent.clear(keyField());
    await typeKey();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  });

  it("keeps a typed key out of the log, and out of the page once it is saved", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), testAccount: answered(50), setAccountKey: claudeAccount });
    await pageReady();
    await typeKey();
    await testConnection();
    const log = (await screen.findByText("Answered: “OK” · 50 ms")).closest("[role=status]")!;
    expect(log.textContent).not.toContain(secret);

    await clickSave();
    await noticeShowing(replaced);

    expect(document.body.innerHTML).not.toContain(secret);
  });
});

describe("the last result of the account, shown on load", () => {
  it("is drawn as a finished log when the account was tested before and it worked", async () => {
    renderEdit("a2", opened(testedBefore(claudeAccount), [metaAccount]));
    await pageReady();

    expect(screen.getByText("Sent: “Reply with the single word OK.”")).toBeInTheDocument();
    const line = screen.getByText("Answered: “OK” · 410 ms");
    expect(line.closest(".mk-result")).not.toHaveClass("bad");
    expect(screen.queryByText(/Sending a short message/)).not.toBeInTheDocument();
  });

  it("is drawn as Not working with the stored reason when the last test failed", async () => {
    renderEdit(
      "a2",
      opened(testedBefore(claudeAccount, { lastTestResult: "the model refused the key", lastTestReply: "", lastTestMs: 90 }), [metaAccount]),
    );
    await pageReady();

    const line = screen.getByText("Not working: the model refused the key · 90 ms");
    expect(line.closest(".mk-result")).toHaveClass("bad");
  });

  it("is left out when the account was never tested, even with a result text", async () => {
    renderEdit("a2", opened({ ...claudeAccount, lastTestResult: "working", lastTestedAt: "" }, [metaAccount]));
    await pageReady();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is left out when the result text is empty", async () => {
    renderEdit("a2", opened(testedBefore(claudeAccount, { lastTestResult: "  " }), [metaAccount]));
    await pageReady();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is left out of the time when the stored time is missing", async () => {
    renderEdit("a2", opened(testedBefore(claudeAccount, { lastTestMs: null }), [metaAccount]));
    await pageReady();

    expect(screen.getByText("Answered: “OK”")).toBeInTheDocument();
  });

  it("gives way to the result of a test run on the page", async () => {
    renderEdit("a2", { ...opened(testedBefore(claudeAccount), [metaAccount]), testAccount: answered(12, "Okay") });
    await pageReady();
    await testConnection();

    expect(await screen.findByText("Answered: “Okay” · 12 ms")).toBeInTheDocument();
    expect(screen.queryByText("Answered: “OK” · 410 ms")).not.toBeInTheDocument();
  });

  it("is gone once the key is replaced, because it belongs to the old key", async () => {
    let held: Account = testedBefore(claudeAccount);
    renderEdit("a2", {
      getAccount: () => held,
      listAccounts: () => [held, metaAccount],
      setAccountKey: () => {
        held = { ...claudeAccount };
        return held;
      },
    });
    await pageReady();
    expect(screen.getByText("Answered: “OK” · 410 ms")).toBeInTheDocument();
    await typeKey();
    await clickSave();
    await noticeShowing(replaced);

    await waitFor(() => expect(screen.queryByText("Answered: “OK” · 410 ms")).not.toBeInTheDocument());
  });
});
