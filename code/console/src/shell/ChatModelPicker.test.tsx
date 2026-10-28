import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, type Account } from "../data/accounts";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { callTool } from "../wakala/mcp";
import { ChatColumn } from "./ChatColumn";
import { chatModelKey } from "./useChatModels";

vi.mock("../data/accounts", async (importOriginal) => ({ ...(await importOriginal<object>()), listAccounts: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const listAccountsMock = vi.mocked(listAccounts);
const askModelMock = vi.mocked(askModel);

const account = (id: string, patch: Partial<Account> = {}): Account => ({
  id,
  name: `account ${id}`,
  provider: "openai",
  baseUrl: "https://models.test/v1",
  modelName: `model-${id}`,
  status: "enabled",
  keySet: true,
  lastTestResult: "working",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: true,
  chatLabel: "",
  ...patch,
});

const glm = account("a1", { chatLabel: "GLM 4.6" });
const qwen = account("a2", { chatLabel: "Qwen 3" });
const llama = account("a3", { chatLabel: "Llama 3.3" });

const answerWith = (accounts: Account[]) => listAccountsMock.mockResolvedValue(accounts);

const openChat = (hubId = "siaya") => {
  const column = (id: string) => (
    <I18nProvider initial={words}>
      <ChatColumn hubId={id} page="status" rail={false} onToggleRail={() => {}} />
    </I18nProvider>
  );
  const view = render(column(hubId));
  return { ...view, switchTo: (id: string) => view.rerender(column(id)) };
};

const chipNow = () => document.querySelector(".chat-model > button") as HTMLButtonElement | null;
const chip = () =>
  waitFor(() => {
    const found = chipNow();
    expect(found).not.toBeNull();
    return found as HTMLButtonElement;
  });
const listbox = () => screen.getByRole("listbox", { name: "Model" });
const optionsShown = () => within(listbox()).getAllByRole("option").map((option) => option.textContent);
const settle = () => act(async () => {});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockRejectedValue(new Error("offline"));
  listAccountsMock.mockReset();
  askModelMock.mockReset();
  askModelMock.mockResolvedValue({ text: "An answer.", calls: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the model picker in the chat box", () => {
  it("shows the first chat model's label on the chip", async () => {
    answerWith([glm, qwen]);
    openChat();

    expect(await chip()).toHaveTextContent("GLM 4.6");
    expect(chipNow()).toHaveAttribute("aria-haspopup", "listbox");
    expect(chipNow()).toHaveAttribute("aria-expanded", "false");
  });

  it("falls back to the model name when the admin gave no label", async () => {
    answerWith([account("a1", { modelName: "glm-4.6" })]);
    openChat();

    expect(await screen.findByRole("button", { name: "glm-4.6" })).toBeInTheDocument();
  });

  it("lists every chat model with the tick on the current one", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen, llama]);
    openChat();

    await user.click(await chip());

    expect(optionsShown()).toEqual(["GLM 4.6", "Qwen 3", "Llama 3.3"]);
    const options = within(listbox()).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(options[0].querySelector("svg")).not.toBeNull();
    expect(options[1].querySelector("svg")).toBeNull();
    expect(chipNow()).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves out models that are disabled or not offered to the chat", async () => {
    const user = userEvent.setup();
    answerWith([glm, account("a2", { chatLabel: "Off", status: "disabled" }), account("a3", { chatLabel: "Hidden", chatEnabled: false }), qwen]);
    openChat();

    await user.click(await chip());

    expect(optionsShown()).toEqual(["GLM 4.6", "Qwen 3"]);
  });

  it("changes the chip, closes the list and keeps the pick when a model is picked", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();

    await user.click(await chip());
    await user.click(within(listbox()).getByRole("option", { name: "Qwen 3" }));

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(chipNow()).toHaveTextContent("Qwen 3");
    expect(localStorage.getItem(chatModelKey("siaya"))).toBe("a2");
  });

  it("opens on the stored pick and ticks it", async () => {
    const user = userEvent.setup();
    localStorage.setItem(chatModelKey("siaya"), "a2");
    answerWith([glm, qwen]);
    openChat();

    expect(await screen.findByRole("button", { name: "Qwen 3" })).toBeInTheDocument();
    await user.click(chipNow()!);

    expect(within(listbox()).getByRole("option", { name: "Qwen 3" })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to the first chat model when the stored pick is no longer one of them", async () => {
    localStorage.setItem(chatModelKey("siaya"), "gone");
    answerWith([glm, qwen]);
    openChat();

    expect(await chip()).toHaveTextContent("GLM 4.6");
    expect(localStorage.getItem(chatModelKey("siaya"))).toBe("gone");
  });

  it("keeps a separate pick for each hub", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    const { switchTo } = openChat("siaya");
    await user.click(await chip());
    await user.click(within(listbox()).getByRole("option", { name: "Qwen 3" }));

    switchTo("kisumu");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalledWith("kisumu"));
    await settle();

    expect(chipNow()).toHaveTextContent("GLM 4.6");
    expect(localStorage.getItem(chatModelKey("siaya"))).toBe("a2");
    expect(localStorage.getItem(chatModelKey("kisumu"))).toBeNull();
  });

  it("shows no chip when no model is offered to the chat", async () => {
    answerWith([account("a1", { chatEnabled: false }), account("a2", { status: "disabled" })]);
    openChat();

    await settle();

    expect(listAccountsMock).toHaveBeenCalled();
    expect(chipNow()).toBeNull();
  });

  it("shows no chip and no error when the models cannot be loaded", async () => {
    listAccountsMock.mockRejectedValue(new Error("down"));
    openChat();

    await settle();

    expect(chipNow()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still shows the chip when there is only one model", async () => {
    const user = userEvent.setup();
    answerWith([glm]);
    openChat();

    expect(await chip()).toHaveTextContent("GLM 4.6");
    await user.click(chipNow()!);

    expect(optionsShown()).toEqual(["GLM 4.6"]);
  });

  it("closes on Escape and returns to the chip", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    await user.click(await chip());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(chipNow()).toHaveFocus();
    expect(chipNow()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a click outside", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    await user.click(await chip());

    await user.click(screen.getByRole("textbox", { name: "Write a message" }));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes when the chip is clicked again", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    await user.click(await chip());

    await user.click(chipNow()!);

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens with Enter, moves with the arrows and picks with Enter", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen, llama]);
    openChat();
    (await chip()).focus();

    await user.keyboard("{Enter}");
    expect(listbox()).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(chipNow()).toHaveTextContent("Qwen 3");
    expect(chipNow()).toHaveFocus();
    expect(localStorage.getItem(chatModelKey("siaya"))).toBe("a2");
  });

  it("opens with Space and picks with Space", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    (await chip()).focus();

    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");

    expect(chipNow()).toHaveTextContent("Qwen 3");
  });

  it("opens with the down arrow from the chip", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    (await chip()).focus();

    await user.keyboard("{ArrowDown}");

    expect(listbox()).toBeInTheDocument();
  });

  it("wraps the arrows around the ends of the list", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen, llama]);
    openChat();
    (await chip()).focus();
    await user.keyboard("{Enter}");

    await user.keyboard("{ArrowUp}{Enter}");

    expect(chipNow()).toHaveTextContent("Llama 3.3");
  });

  it("keeps working when the browser refuses to store or read the pick", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    answerWith([glm, qwen]);
    openChat();

    expect(await chip()).toHaveTextContent("GLM 4.6");
    await user.click(chipNow()!);
    await user.click(within(listbox()).getByRole("option", { name: "Qwen 3" }));

    expect(chipNow()).toHaveTextContent("Qwen 3");
  });
});

describe("the model that answers", () => {
  const sayHi = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByRole("textbox", { name: "Write a message" }), "hi{Enter}");
    await screen.findByText("An answer.");
  };

  it("is the first chat model until another is picked", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen]);
    openChat();
    await chip();

    await sayHi(user);

    expect(askModelMock).toHaveBeenCalledWith("siaya", "a1", [{ role: "user", content: "hi" }], "status", "", expect.any(AbortSignal));
  });

  it("is the model picked in the box, and a later pick answers the next message", async () => {
    const user = userEvent.setup();
    answerWith([glm, qwen, llama]);
    openChat();
    await user.click(await chip());
    await user.click(within(listbox()).getByRole("option", { name: "Qwen 3" }));

    await sayHi(user);

    expect(askModelMock).toHaveBeenLastCalledWith("siaya", "a2", [{ role: "user", content: "hi" }], "status", "", expect.any(AbortSignal));

    await user.click(chipNow()!);
    await user.click(within(listbox()).getByRole("option", { name: "Llama 3.3" }));
    await user.type(screen.getByRole("textbox", { name: "Write a message" }), "again{Enter}");

    await waitFor(() => expect(askModelMock).toHaveBeenCalledTimes(2));
    expect(askModelMock).toHaveBeenLastCalledWith("siaya", "a3", [
      { role: "user", content: "hi" },
      { role: "assistant", content: "An answer." },
      { role: "user", content: "again" },
    ], "status", "", expect.any(AbortSignal));
  });

  it("is the model stored for the hub when the page opens", async () => {
    const user = userEvent.setup();
    localStorage.setItem(chatModelKey("siaya"), "a2");
    answerWith([glm, qwen]);
    openChat();
    await screen.findByRole("button", { name: "Qwen 3" });

    await sayHi(user);

    expect(askModelMock).toHaveBeenCalledWith("siaya", "a2", expect.anything(), "status", "", expect.any(AbortSignal));
  });
});
