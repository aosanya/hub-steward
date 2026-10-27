import { screen, within } from "@testing-library/react";
import { callsTo, claudeAccount, metaAccount, opened, pageReady, renderEdit } from "./editTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  getAccount: vi.fn(),
  listAccounts: vi.fn(),
  updateAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const modelLabel = /^Model\*?$/;

describe("the model's page for a Meta Model API account", () => {
  it("is titled with the provider and the model and reads the account of its hub", async () => {
    const calls = renderEdit("a1", opened(metaAccount));

    expect(await screen.findByRole("heading", { level: 1, name: "Meta Model API · Muse Spark 1.3" })).toBeInTheDocument();
    expect(callsTo(calls, "getAccount")[0].args).toEqual(["h1", "a1"]);
    expect(callsTo(calls, "listAccounts")[0].args).toEqual(["h1"]);
  });

  it("shows the provider and the address as fixed values and the saved model chosen", async () => {
    renderEdit("a1", opened(metaAccount));
    const card = (await pageReady()).closest("section")!;

    const provider = within(card).getByLabelText("Provider");
    expect(provider).toHaveValue("Meta Model API");
    expect(provider).toHaveAttribute("readonly");
    expect(within(card).getByLabelText("Base address")).toHaveValue("https://api.meta.ai/v1");
    expect(within(card).getByLabelText("Base address")).toHaveAttribute("readonly");
    expect(within(card).getByLabelText(modelLabel)).toHaveDisplayValue("Muse Spark 1.3 (muse-spark-1.3)");
  });

  it("offers Key and test as the page it is on, with Limits and Usage beside it", async () => {
    renderEdit("a1", opened(metaAccount));
    await pageReady();

    expect(screen.getByText("Key and test")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Limits" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usage" })).toBeInTheDocument();
  });

  it("draws no Used by link and no inline Saved line", async () => {
    renderEdit("a1", opened(metaAccount));
    await pageReady();

    for (const gone of [/Used by/, /^Saved$/])
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
  });

  it("says what the key is for and that the saved key is never shown, over an empty field", async () => {
    renderEdit("a1", opened(metaAccount));
    await pageReady();

    expect(screen.getByText(/This key lets the hub's agents read members' messages/)).toBeInTheDocument();
    expect(screen.getByText("The saved key is never shown.")).toBeInTheDocument();
    expect(screen.getByLabelText("Replace the key")).toHaveValue("");
  });
});

describe("the model's page for a Claude account", () => {
  it("is titled Claude · Sonnet 5.5 with the provider and model, and no base address to show", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    const card = (await pageReady()).closest("section")!;

    expect(screen.getByRole("heading", { level: 1, name: "Claude · Sonnet 5.5" })).toBeInTheDocument();
    expect(within(card).getByLabelText("Provider")).toHaveValue("Claude");
    expect(within(card).getByLabelText(modelLabel)).toHaveDisplayValue("Sonnet 5.5 (claude-sonnet-5-5)");
    expect(within(card).queryByLabelText("Base address")).not.toBeInTheDocument();
  });

  it("asks for the key with the Claude example in the field", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();

    expect(screen.getByPlaceholderText("Paste your key, e.g. sk-ant-…")).toBeInTheDocument();
  });
});

describe("when the page cannot be loaded", () => {
  it("says so when the account cannot be read, and leads back to the Models list", async () => {
    renderEdit("a1", { getAccount: new Error("not found"), listAccounts: [metaAccount] });

    expect((await screen.findByText("The page could not be loaded.")).closest(".empty")).toHaveClass("error");
    expect(screen.queryByRole("heading", { name: "Connect a model" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Models" })).toHaveAttribute("href", "/h/h1/models");
  });

  it("says so when the hub's accounts cannot be listed", async () => {
    renderEdit("a1", { getAccount: metaAccount, listAccounts: new Error("down") });

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connect a model" })).not.toBeInTheDocument();
  });

  it("titles the page Models, with the way back to the list and no tabs, for an address no model holds", async () => {
    renderEdit("a9", { getAccount: new Error("not found"), listAccounts: [] });
    await screen.findByText("The page could not be loaded.");

    expect(screen.getByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Models" })).toHaveAttribute("href", "/h/h1/models");
    expect(document.querySelector(".tabs")).toBeNull();
  });
});
