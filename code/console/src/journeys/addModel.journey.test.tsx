import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { ModelAddPage } from "../pages/models/ModelAddPage";
import { ModelPage } from "../pages/models/ModelPage";
import { ModelsPage } from "../pages/ModelsPage";
import { hubWithoutKey, labelled, renderOnStage } from "../pages/models/harness";
import { callTool } from "../wakala/mcp";
import { aiTools, createFakeAiBackend, probeMessage, providerAnswered, providerRefused, testSentences, type FakeProvider } from "./fakeAiBackend";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.unmock("../data/accountModels");

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const randomKey = () => `rk-${crypto.randomUUID().replaceAll("-", "")}`;

const firstKey = randomKey();
const secondKey = randomKey();
const keyPattern = /^rk-[0-9a-f]{32}$/;
const anyKey = /rk-[0-9a-f]{32}/;

const modelTitle = "Meta Model API · Muse Spark 1.3";
const modelAdded = "Model added";
const keyReplaced = "The key for Meta Model API Muse Spark 1.3 was replaced.";
const sentLine = `Sent: “${probeMessage}”`;
const refusedLine = `Not working: ${testSentences.refused} · 80 ms`;
const answeredLine = "Answered: “OK” · 640 ms";
const sendingLine = "Sending a short message to Meta Model API…";

const validKeys = new Set<string>();
const keysTried: string[] = [];
let gate: Promise<void> = Promise.resolve();

const holdProvider = () => {
  let release!: () => void;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () => {
    release();
    gate = Promise.resolve();
  };
};

const provider: FakeProvider = async ({ key }) => {
  keysTried.push(key);
  await gate;
  return validKeys.has(key) ? providerAnswered("OK", 640) : providerRefused(80);
};

const backend = createFakeAiBackend({ hubId: hubWithoutKey.id, provider, roles: [], latencyMs: 5 });
const fetching = vi.fn(async () => {
  throw new Error("this journey never leaves the AI backend's tools");
});

const noticesSeen = new Set<string>();
const leaks: string[] = [];

const withoutTypedValues = () => {
  const copy = document.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("input, textarea").forEach((field) => field.removeAttribute("value"));
  return copy.innerHTML;
};

const watcher = new MutationObserver(() => {
  document.querySelectorAll(".notice-text").forEach((text) => noticesSeen.add(text.textContent ?? ""));
  const page = withoutTypedValues();
  [firstKey, secondKey].filter((key) => page.includes(key)).forEach((key) => leaks.push(key));
});

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const keyOnPage = (key: string) =>
  document.body.innerHTML.includes(key) || [...document.querySelectorAll<Field>("input, textarea, select")].some((field) => field.value.includes(key));

const addKeyField = () => screen.getByLabelText("Meta Model API key");
const replaceKeyField = () => screen.getByLabelText("Replace the key");
const saveButtons = () => screen.queryAllByRole("button", { name: "Save" });
const testButton = () => screen.getByRole("button", { name: "Test connection" });
const press = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const follow = (name: string) => userEvent.click(screen.getByRole("link", { name }));
const noticeBar = () => document.querySelector(".notice");

const isModelsTable = (table: HTMLElement) => within(table).queryByRole("columnheader", { name: "Key" }) !== null;
const modelsTable = () => screen.queryAllByRole("table").find(isModelsTable);
const availableRows = () =>
  screen
    .queryAllByRole("table")
    .filter((table) => !isModelsTable(table))
    .flatMap((table) => within(table).getAllByRole("row"));
const availableRow = (modelId: string) => availableRows().find((row) => within(row).queryByText(modelId) !== null)!;

const toolsCalled = () => backend.calls.map((call) => call.tool);
const accountId = () => backend.accounts()[0].id;

beforeAll(() => {
  vi.stubGlobal("fetch", fetching);
  vi.mocked(callTool).mockImplementation(backend.callTool as unknown as typeof callTool);
  watcher.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  renderOnStage(
    <Routes>
      <Route path="/h/:hubId/models" element={<ModelsPage />} />
      <Route path="/h/:hubId/models/new" element={<ModelAddPage />} />
      <Route path="/h/:hubId/models/:accountId/:tab" element={<ModelPage />} />
    </Routes>,
    [hubWithoutKey],
    "/h/hub-a/models",
  );
});

afterAll(() => {
  watcher.disconnect();
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.RTL_SKIP_AUTO_CLEANUP;
});

describe("journey 10, steps 1 and 2: the manager adds a model with a random key and tests it", () => {
  it("uses two random keys that look like keys and are never real", () => {
    expect(firstKey).toMatch(keyPattern);
    expect(secondKey).toMatch(keyPattern);
    expect(firstKey).not.toBe(secondKey);
  });

  it("1. a hub with no model says so, offers Add a model, and lists Meta Model API's models first under Available to add", async () => {
    expect(await screen.findByText("No model yet. Add one so the hub's agents can reply.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a model" })).toHaveLength(1);
    expect(modelsTable()).toBeUndefined();

    expect(screen.getByRole("heading", { level: 2, name: "Available to add" })).toBeInTheDocument();
    const groups = [...document.querySelectorAll("strong")].map((group) => group.textContent);
    expect(groups).toEqual(["Meta Model API", "Meta open weights (your own server)", "Hugging Face", "Claude"]);
    const firstAdd = screen.getAllByRole("link", { name: "Add" })[0].closest("tr") as HTMLElement;
    expect(within(firstAdd).getByText("Muse Spark 1.3")).toBeInTheDocument();
    expect(within(firstAdd).getByText("muse-spark-1.3")).toBeInTheDocument();
    expect(screen.queryByText("Added")).not.toBeInTheDocument();

    expect(new Set(toolsCalled())).toEqual(new Set(["ai_list_accounts"]));
    expect(backend.accounts()).toEqual([]);
  });

  it("2. Add a model opens with Meta Model API and Muse Spark 1.3 chosen, its key field named for Meta Model API, and the chat fields on", async () => {
    await follow("Add a model");

    expect(await screen.findByRole("heading", { level: 1, name: "Add a model" })).toBeInTheDocument();
    expect(screen.getByLabelText(labelled("Provider"))).toHaveDisplayValue("Meta Model API");
    expect(screen.getByLabelText(labelled("Model"))).toHaveDisplayValue("Muse Spark 1.3 (muse-spark-1.3)");
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("https://api.meta.ai/v1");
    expect(addKeyField()).toHaveValue("");

    expect(screen.getByRole("checkbox", { name: "Can be used in the chat" })).toBeChecked();
    expect(screen.getByLabelText("Name in the chat")).toBeEnabled();
    expect(screen.getByLabelText("Name in the chat")).toHaveValue("Muse Spark 1.3");

    expect(saveButtons()).toHaveLength(1);
    expect(saveButtons()[0]).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Save model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save key" })).not.toBeInTheDocument();
    expect(testButton()).toBeDisabled();
    expect(backend.callsTo("ai_create_account")).toHaveLength(0);
  });

  it("3. the one Save adds the model, then stores the random key; the form locks and the key field empties", async () => {
    await userEvent.type(addKeyField(), firstKey);
    expect(saveButtons()).toHaveLength(1);
    await userEvent.click(saveButtons()[0]);
    await screen.findByRole("button", { name: "Saved" });

    const [created] = backend.callsTo("ai_create_account");
    expect(backend.callsTo("ai_create_account")).toHaveLength(1);
    expect(created.args).toMatchObject({
      name: modelTitle,
      provider: "openai_compatible",
      base_url: "https://api.meta.ai/v1",
      model_name: "muse-spark-1.3",
      status: "enabled",
      chat_enabled: true,
    });
    expect(["", "Muse Spark 1.3", undefined]).toContain(created.args.chat_label);

    const [storedKey] = backend.callsTo("ai_set_account_key");
    expect(backend.callsTo("ai_set_account_key")).toHaveLength(1);
    expect(storedKey.args).toEqual({ accountID: accountId(), key: firstKey });
    expect(backend.calls.indexOf(created)).toBeLessThan(backend.calls.indexOf(storedKey));
    expect(backend.accounts()).toHaveLength(1);
    expect(backend.accounts()[0]).toMatchObject({ key_set: true, chat_enabled: true });
    expect(backend.callsTo("ai_set_default_account")).toEqual([expect.objectContaining({ args: { accountID: accountId() } })]);
    expect(backend.accounts()[0].default).toBe(true);

    expect(noticeBar()).toHaveTextContent(modelAdded);
    expect(noticeBar()).toHaveAttribute("role", "status");
    expect(screen.getByLabelText(labelled("Provider"))).toBeDisabled();
    expect(screen.getByLabelText(labelled("Base address"))).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Can be used in the chat" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Can be used in the chat" })).toBeChecked();
    expect(screen.getByLabelText("Name in the chat")).toBeDisabled();
    expect(addKeyField()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    expect(testButton()).toBeEnabled();
    expect(keyOnPage(firstKey)).toBe(false);
  });

  it("3b. once the key is saved the Model dropdown shows the models the key can use above the standard list", async () => {
    await screen.findByText("Refresh models");

    expect(backend.callsTo("ai_refresh_models").map((call) => call.args)).toEqual([{ accountID: accountId() }]);
    const model = screen.getByLabelText(labelled("Model"));
    expect(model).toBeEnabled();
    expect(within(model).getByRole("group", { name: "From your key" })).toBeInTheDocument();
    expect(within(model).getByRole("option", { name: "muse-spark-1.4" })).toBeInTheDocument();
    expect(keyOnPage(firstKey)).toBe(false);
  });

  it("4. Test connection with that random key shows the process and says the model refused the key", async () => {
    const release = holdProvider();
    await userEvent.click(testButton());

    expect(await screen.findByText(sendingLine)).toBeInTheDocument();
    expect(testButton()).toBeDisabled();
    expect(screen.queryByText(sentLine)).not.toBeInTheDocument();

    release();
    expect(await screen.findByText(sentLine)).toBeInTheDocument();
    expect(await screen.findByText(refusedLine)).toBeInTheDocument();
    expect(screen.queryByText(sendingLine)).not.toBeInTheDocument();
    expect(testButton()).toBeEnabled();

    expect(backend.callsTo("ai_test_account").map((call) => call.args)).toEqual([{ accountID: accountId() }]);
    expect(backend.probes).toEqual([{ provider: "openai_compatible", baseUrl: "https://api.meta.ai/v1", modelName: "muse-spark-1.3", message: probeMessage }]);
    expect(keysTried).toEqual([firstKey]);
    expect(backend.accounts()[0]).toMatchObject({
      last_test_result: testSentences.refused,
      last_test_prompt: probeMessage,
      last_test_reply: "",
      last_test_ms: 80,
    });
    expect(keyOnPage(firstKey)).toBe(false);
  });

  it("5. Back to Models lists the model with its provider, model id and key set, and Available to add shows it as added", async () => {
    await press("Back to Models");
    expect(await screen.findByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    const toggle = await screen.findByRole("button", { name: "Muse Spark 1.3" });
    await userEvent.click(toggle);
    const row = toggle.closest("section") as HTMLElement;
    expect(within(row).getByText("Meta Model API")).toBeInTheDocument();
    expect(within(row).getByText("muse-spark-1.3")).toBeInTheDocument();
    expect(within(row).getByText("set")).toBeInTheDocument();
    expect(await within(row).findByText("Used by no roles")).toBeInTheDocument();
    expect(screen.queryByText("No model yet. Add one so the hub's agents can reply.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a model" })).toBeInTheDocument();

    const added = availableRow("muse-spark-1.3");
    expect(within(added).getByText("Added")).toBeInTheDocument();
    expect(within(added).queryByRole("link", { name: "Add" })).not.toBeInTheDocument();
    expect(within(availableRow("muse-spark-1.2")).getByRole("link", { name: "Add" })).toBeInTheDocument();
    expect(keyOnPage(firstKey)).toBe(false);
  });

  it("6. Edit replaces the key with a second random key in one Save, clears the old test log, and the new key works", async () => {
    validKeys.add(secondKey);
    const row = screen.getByRole("button", { name: "Muse Spark 1.3" }).closest("section") as HTMLElement;
    await userEvent.click(within(row).getByRole("link", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: "Connect a model" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: modelTitle })).toBeInTheDocument();
    expect(backend.callsTo("ai_get_account").map((call) => call.args)).toContainEqual({ accountID: accountId() });
    expect(screen.getByText(sentLine)).toBeInTheDocument();
    expect(screen.getByText(refusedLine)).toBeInTheDocument();
    expect(testButton()).toBeEnabled();
    expect(saveButtons()).toHaveLength(0);

    await userEvent.type(replaceKeyField(), secondKey);
    expect(saveButtons()).toHaveLength(1);
    expect(keyOnPage(firstKey)).toBe(false);
    const formBefore = screen.getByRole("heading", { name: "Connect a model" });
    await userEvent.click(saveButtons()[0]);

    expect(await screen.findByText(keyReplaced)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Connect a model" })).not.toBe(formBefore));
    expect(replaceKeyField()).toHaveValue("");
    expect(screen.queryByText(refusedLine)).not.toBeInTheDocument();
    expect(screen.queryByText(sentLine)).not.toBeInTheDocument();
    expect(saveButtons()).toHaveLength(0);

    const stored = backend.callsTo("ai_set_account_key");
    expect(stored).toHaveLength(2);
    expect(stored[1].args).toEqual({ accountID: accountId(), key: secondKey });
    expect(backend.callsTo("ai_update_account")).toHaveLength(0);
    expect(backend.callsTo("ai_create_account")).toHaveLength(1);
    expect(backend.accounts()[0]).toMatchObject({ key_set: true, last_test_prompt: "", last_test_reply: "", last_test_ms: 0 });
    expect(backend.accounts()[0].last_test_result).toBeUndefined();
    expect(keyOnPage(firstKey)).toBe(false);
    expect(keyOnPage(secondKey)).toBe(false);

    await userEvent.click(testButton());
    expect(await screen.findByText(answeredLine)).toBeInTheDocument();
    expect(screen.getByText(sentLine)).toBeInTheDocument();
    expect(screen.queryByText(/^Not working/)).not.toBeInTheDocument();
    expect(keysTried).toEqual([firstKey, secondKey]);
    expect(backend.accounts()[0]).toMatchObject({
      last_test_result: testSentences.working,
      last_test_prompt: probeMessage,
      last_test_reply: "OK",
      last_test_ms: 640,
    });
    expect(keyOnPage(firstKey)).toBe(false);
    expect(keyOnPage(secondKey)).toBe(false);
  });

  it("7. across the whole journey no key reached the page, a notice or a call but the one that stores it, and nothing left the AI backend's tools", () => {
    expect(leaks).toEqual([]);
    expect(keyOnPage(firstKey)).toBe(false);
    expect(keyOnPage(secondKey)).toBe(false);

    expect([...noticesSeen]).toEqual(expect.arrayContaining([modelAdded, keyReplaced]));
    [firstKey, secondKey].forEach((key) => [...noticesSeen].forEach((notice) => expect(notice).not.toContain(key)));

    const keysSent = backend.callsTo("ai_set_account_key").map((call) => call.args.key);
    expect(keysSent).toEqual([firstKey, secondKey]);
    const carriers = backend.calls.filter((call) => anyKey.test(JSON.stringify(call.args)));
    expect(carriers.map((call) => call.tool)).toEqual(["ai_set_account_key", "ai_set_account_key"]);
    const argsWithoutKeys = JSON.stringify(backend.calls.map((call) => (call.tool === "ai_set_account_key" ? { ...call, args: { accountID: call.args.accountID } } : call)));
    [firstKey, secondKey].forEach((key) => expect(argsWithoutKeys).not.toContain(key));
    [firstKey, secondKey].forEach((key) => expect(JSON.stringify(backend.answers)).not.toContain(key));

    expect(fetching).not.toHaveBeenCalled();
    expect(backend.rejected).toEqual([]);
    expect(toolsCalled().every((tool) => (aiTools as readonly string[]).includes(tool))).toBe(true);
    expect(new Set(toolsCalled())).toEqual(
      new Set([
        "ai_list_accounts",
        "ai_create_account",
        "ai_set_default_account",
        "ai_set_account_key",
        "ai_test_account",
        "ai_get_account",
        "ai_refresh_models",
        "ai_list_roles",
      ]),
    );
    expect(new Set(backend.calls.map((call) => call.hubId))).toEqual(new Set([hubWithoutKey.id]));
  });
});
