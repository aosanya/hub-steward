import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import userEvent from "@testing-library/user-event";
import { claudeHub, hubWithKey, hubWithoutKey, renderOnStage, secondHub } from "../models/harness";
import { StatusView } from "./StatusView";

vi.mock("../../wakala/mcp");

type Answers = { roles: unknown; joinMode: unknown; agency: unknown; accounts: unknown; failOn?: string };

const answers: Answers = { roles: {}, joinMode: {}, agency: {}, accounts: { items: [] } };

const accountFor = (provider: "openai_compatible" | "anthropic", baseUrl: string, modelName: string) => ({
  items: [{ id: "a1", name: "Model", provider, base_url: baseUrl, model_name: modelName, status: "enabled", key_set: true }],
});

const huggingFaceAccount = () => accountFor("openai_compatible", "https://router.huggingface.co/v1", "zai-org/GLM-5.3:novita");

const claudeAccount = () => accountFor("anthropic", "https://api.anthropic.com", "claude-sonnet-5-5");

const farmersHub = () => {
  answers.agency = { name: "Siaya Farmers' Group" };
  answers.joinMode = { join_mode: "open" };
  answers.roles = { items: [{ id: "r1", name: "Group coordinator" }, { id: "r5", name: "Farmers' coordinator", permissions: ["ai.use"] }] };
  answers.accounts = { items: [] };
  answers.failOn = undefined;
};

beforeEach(() => {
  farmersHub();
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (tool === answers.failOn) throw new Error("boom");
    if (tool === "agency_get_agency") return answers.agency as never;
    if (tool === "instance_get_join_mode") return answers.joinMode as never;
    if (tool === "agency_list_roles") return answers.roles as never;
    if (tool === "ai_list_accounts") return answers.accounts as never;
    return { items: [] } as never;
  });
});

afterEach(() => {
  localStorage.clear();
});

const tileOf = (label: string) => screen.getByText(label).closest(".tile") as HTMLElement;

const findTile = async (label: string) => (await screen.findByText(label)).closest(".tile") as HTMLElement;

describe("the Status page while the model key is not set", () => {
  it("asks to finish setting up the hub and counts three of four ready", async () => {
    renderOnStage(<StatusView />, [hubWithoutKey]);

    expect(await screen.findByRole("heading", { name: "Finish setting up your hub", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("3 of 4 ready")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  });

  it("shows the four tiles with the coordinator, the members, the agent and the model key", async () => {
    renderOnStage(<StatusView />, [hubWithoutKey]);
    await screen.findByText("3 of 4 ready");

    expect(within(tileOf("Group coordinator")).getByText("You")).toBeInTheDocument();
    expect(within(tileOf("Members")).getByText("Open to join")).toBeInTheDocument();
    expect(within(tileOf("Farmers' coordinator")).getByText("Agent connected")).toBeInTheDocument();
    expect(within(tileOf("Model key")).getByText("Needed to reply")).toBeInTheDocument();
  });

  it("marks only the model key tile as needing attention and leads it to Models", async () => {
    renderOnStage(<StatusView />, [hubWithoutKey]);
    await screen.findByText("3 of 4 ready");

    const model = tileOf("Model key");
    expect(model).toHaveClass("warn");
    expect(model).toHaveAttribute("href", "/h/hub-a/models");
    expect(tileOf("Members")).not.toHaveClass("warn");
    expect(tileOf("Members").tagName).toBe("DIV");
  });

  it("offers Add a model in the title row, leading to Models", async () => {
    renderOnStage(<StatusView />, [hubWithoutKey]);

    expect(await screen.findByRole("link", { name: "Add a model" })).toHaveAttribute("href", "/h/hub-a/models");
    expect(screen.getByRole("heading", { name: "Status", level: 1 })).toBeInTheDocument();
  });

  it("marks the coordinator and the agent as missing when the agency has neither", async () => {
    answers.roles = { items: [] };
    renderOnStage(<StatusView />, [hubWithoutKey]);
    await screen.findByText("1 of 4 ready");

    expect(within(tileOf("Hub manager")).getByText("No role yet")).toBeInTheDocument();
    expect(tileOf("Hub manager")).toHaveClass("warn");
    expect(within(tileOf("Agent")).getByText("No agent yet")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("says joining needs approval when the hub asks for it", async () => {
    answers.joinMode = { join_mode: "confirmed" };
    renderOnStage(<StatusView />, [hubWithoutKey]);

    expect(within(await findTile("Members")).getByText("Approval required")).toBeInTheDocument();
  });
});

describe("the Status page once the model key is set", () => {
  beforeEach(() => {
    answers.accounts = huggingFaceAccount();
  });

  it("says the hub is ready, four of four, and names the provider next to the key", async () => {
    renderOnStage(<StatusView />, [hubWithKey]);

    expect(await screen.findByRole("heading", { name: "Your hub is ready", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("4 of 4 ready")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(within(tileOf("Model key")).getByText("Hugging Face · set")).toBeInTheDocument();
    expect(tileOf("Model key")).not.toHaveClass("warn");
  });

  it("names Claude when the hub's key is for Claude", async () => {
    answers.accounts = claudeAccount();
    renderOnStage(<StatusView />, [claudeHub]);

    expect(within(await findTile("Model key")).getByText("Claude · set")).toBeInTheDocument();
  });

  it("no longer offers Add a model in the title row", async () => {
    renderOnStage(<StatusView />, [hubWithKey]);
    await screen.findByText("4 of 4 ready");

    expect(screen.queryByRole("link", { name: "Add a model" })).not.toBeInTheDocument();
  });

  it("keeps the model key tile leading to Models", async () => {
    renderOnStage(<StatusView />, [hubWithKey]);
    await screen.findByText("4 of 4 ready");

    expect(tileOf("Model key")).toHaveAttribute("href", "/h/hub-a/models");
  });
});

describe("the Status page after switching hub", () => {
  it("reads the hub switched to and shows its own key as set", async () => {
    vi.mocked(callTool).mockImplementation(async (hubId, tool) => {
      if (tool === "agency_get_agency") return answers.agency as never;
      if (tool === "instance_get_join_mode") return answers.joinMode as never;
      if (tool === "agency_list_roles") return answers.roles as never;
      if (tool === "ai_list_accounts") return (hubId === "hub-b" ? huggingFaceAccount() : { items: [] }) as never;
      return { items: [] } as never;
    });
    renderOnStage(<StatusView />, [hubWithoutKey, secondHub]);
    await screen.findByText("3 of 4 ready");

    await userEvent.click(screen.getByRole("button", { name: "Switch hub" }));

    expect(await screen.findByText("4 of 4 ready")).toBeInTheDocument();
    expect(vi.mocked(callTool).mock.calls.some((call) => call[0] === "hub-b")).toBe(true);
  });
});

describe("the Status page when the hub cannot be read", () => {
  it("says the page could not be loaded and shows no tiles", async () => {
    answers.failOn = "agency_list_roles";
    renderOnStage(<StatusView />, [hubWithoutKey]);

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.queryByText("Model key")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("still names the page and offers Add a model", async () => {
    answers.failOn = "agency_get_agency";
    renderOnStage(<StatusView />, [hubWithoutKey]);
    await screen.findByText("The page could not be loaded.");

    expect(screen.getByRole("heading", { name: "Status", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a model" })).toBeInTheDocument();
  });
});

describe("the Status page in another language", () => {
  it("speaks German", async () => {
    localStorage.setItem("lang", "de");
    renderOnStage(<StatusView />, [hubWithoutKey]);

    expect(await screen.findByText("3 von 4 bereit")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schließe die Einrichtung deines Hubs ab" })).toBeInTheDocument();
    expect(within(tileOf("Modellschlüssel")).getByText("Nötig, um zu antworten")).toBeInTheDocument();
  });
});
