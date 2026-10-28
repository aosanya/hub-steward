import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { currentAddress } from "./locationSpy";
import { labelled, press, renderAddPage, stubAccounts } from "./addTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const provider = () => screen.getByLabelText(labelled("Provider"));
const model = () => screen.getByLabelText(labelled("Model"));
const base = () => screen.getByLabelText(labelled("Base address"));

describe("the Add page opened from an address", () => {
  it("opens on Meta Model API and Muse Spark 1.3 when the address chooses nothing", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new");

    expect(screen.getByRole("heading", { name: "Add a model", level: 1 })).toBeInTheDocument();
    expect(provider()).toHaveValue("meta");
    expect(model()).toHaveValue("muse-spark-1.3");
    expect(base()).toHaveValue("https://api.meta.ai/v1");
  });

  it("opens on Claude Sonnet 5.5 when the address names that provider and model", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=claude&model=claude-sonnet-5-5");

    expect(provider()).toHaveValue("claude");
    expect(model()).toHaveValue("claude-sonnet-5-5");
  });

  it("opens on the model, provider and address the Available to add link carried", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=meta&model=muse-spark-1.2&base=https%3A%2F%2Fapi.meta.ai%2Fv1");

    expect(provider()).toHaveValue("meta");
    expect(model()).toHaveValue("muse-spark-1.2");
    expect(base()).toHaveValue("https://api.meta.ai/v1");
  });

  it("opens on an open-weights model with the empty address the link carried", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=meta_open&model=muse-glimmer&base=");

    expect(provider()).toHaveValue("meta_open");
    expect(model()).toHaveValue("muse-glimmer");
    expect(base()).toHaveValue("");
  });

  it("falls back to the first start when the address names a provider the catalog does not know", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=nobody&model=nothing");

    expect(provider()).toHaveValue("meta");
    expect(model()).toHaveValue("muse-spark-1.3");
  });

  it("takes the provider's own default model and address when the address names only the provider", () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=meta");

    expect(provider()).toHaveValue("meta");
    expect(model()).toHaveValue("muse-spark-1.3");
    expect(base()).toHaveValue("https://api.meta.ai/v1");
  });
});

describe("leaving the Add page", () => {
  it("offers Back to Models only once the account is created, and it goes to the list", async () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=claude&model=claude-sonnet-5-5");
    expect(screen.queryByRole("button", { name: "Back to Models" })).not.toBeInTheDocument();

    await press("Save");
    await userEvent.click(await screen.findByRole("button", { name: "Back to Models" }));

    expect(currentAddress()).toBe("/h/hub-a/models");
  });

  it("stays on its address with its notice after Save", async () => {
    stubAccounts();
    renderAddPage("/h/hub-a/models/new?provider=claude&model=claude-sonnet-5-5");
    await press("Save");

    expect(await screen.findByText("Model added")).toBeInTheDocument();
    expect(currentAddress()).toBe("/h/hub-a/models/new?provider=claude&model=claude-sonnet-5-5");
  });
});
