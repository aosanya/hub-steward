import { screen, within } from "@testing-library/react";
import { type ModelAccount } from "../../data/modelLimits";
import { modelUsage, type LimitUse, type ModelUse, type RoleUse } from "../../data/modelUsage";
import type { Hub } from "../../types";
import { glm, openModel, owner, sonnet, staff } from "./harness";

vi.mock("../../data/accounts", async (original) => {
  const actual = await original<typeof import("../../data/accounts")>();
  return { ...actual, listAccounts: vi.fn() };
});

vi.mock("../../data/modelLimits", async (original) => {
  const actual = await original<typeof import("../../data/modelLimits")>();
  return { ...actual, modelAccounts: vi.fn() };
});

vi.mock("../../data/modelUsage", async (original) => {
  const actual = await original<typeof import("../../data/modelUsage")>();
  return { ...actual, modelUsage: vi.fn() };
});

const rows: LimitUse[] = [
  { key: "tokens_per_call", max: 8000, used: null },
  { key: "tokens_per_day", max: 200000, used: 61200 },
  { key: "tokens_per_month", max: 4000000, used: 1480000 },
  { key: "requests_per_day", max: 1500, used: 412 },
  { key: "requests_per_minute", max: 30, used: 6 },
];

const coordinator: RoleUse = { id: "r1", name: "Farmers' coordinator", today: 61200, month: 1480000, requests: 412, share: 100 };

const within_limits: ModelUse = { rows, reached: "", roles: [coordinator] };

const riders: RoleUse[] = [
  { id: "r1", name: "Dispatcher", today: 27100, month: 640000, requests: 171, share: 43 },
  { id: "r2", name: "Hub Steward", today: 17800, month: 410000, requests: 112, share: 28 },
  { id: "r3", name: "Assets Keeper", today: 10900, month: 270000, requests: 87, share: 18 },
  { id: "r4", name: "Network Watcher", today: 5400, month: 160000, requests: 42, share: 11 },
];

const open = async (models: ModelAccount[] | Error, use: ModelUse | Error = within_limits, hub: Hub = owner, id: string = glm.id) => {
  vi.mocked(modelUsage).mockReset();
  if (use instanceof Error) vi.mocked(modelUsage).mockRejectedValue(use);
  else vi.mocked(modelUsage).mockResolvedValue(use);
  await openModel(models, "usage", hub, id);
};

const tableAfter = (title: string) => {
  const head = screen.getByRole("heading", { level: 2, name: title }).closest(".section-head") as HTMLElement;
  return within(head.nextElementSibling as HTMLElement);
};

const rowOf = (table: ReturnType<typeof within>, label: string) => within(table.getByText(label).closest("tr") as HTMLElement);

describe("the Usage tab of a model", () => {
  it("is titled with the provider and the model and reads the use of the model the hub holds", async () => {
    await open([glm]);
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(modelUsage).toHaveBeenCalledWith("h1", glm);
  });

  it("offers Key and test and Limits as the pages beside it, and Usage as the page it is on", async () => {
    await open([glm]);
    expect(screen.getByText("Usage", { selector: ".tab" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Key and test" })).toHaveAttribute("href", "/h/h1/models/c1/key");
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("href", "/h/h1/models/c1/limits");
  });

  it("draws the use against each limit as a table of Limit, Used, Max and Share", async () => {
    await open([glm]);
    const table = tableAfter("Use against each limit");
    expect(table.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Limit", "Used", "Max", "Share"]);
    expect(table.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Tokens per call",
      "Tokens per day",
      "Tokens per month",
      "Requests per day",
      "Requests per minute",
    ]);
  });

  it("reads what is used, the maximum and the share of each counted limit", async () => {
    await open([glm]);
    const day = rowOf(tableAfter("Use against each limit"), "Tokens per day");
    expect(day.getByText("61,200")).toHaveClass("count");
    expect(day.getByText("200,000")).toHaveClass("count");
    expect(day.getByText("31%")).toHaveClass("tag", "mute");
    expect(rowOf(tableAfter("Use against each limit"), "Requests per minute").getByText("20%")).toBeInTheDocument();
  });

  it("reads tokens per call as not counted, its maximum, and a cap on each call in place of a share", async () => {
    await open([glm]);
    const call = rowOf(tableAfter("Use against each limit"), "Tokens per call");
    expect(call.getByText("not counted")).toHaveClass("muted");
    expect(call.getByText("8,000")).toHaveClass("count");
    expect(call.getByText("A cap on each call")).toHaveClass("tag", "mute");
  });

  it("draws no banner while no limit is reached", async () => {
    await open([glm]);
    expect(screen.queryByText("Limit reached")).not.toBeInTheDocument();
    expect(screen.queryByText("Reached")).not.toBeInTheDocument();
  });

  it("splits this month's use by AI role into Today, This month, Requests and Share", async () => {
    await open([glm]);
    const table = tableAfter("By AI role, this month");
    expect(table.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["AI role", "Today", "This month", "Requests", "Share"]);
    const role = rowOf(table, "Farmers' coordinator");
    expect(role.getByText("61,200")).toHaveClass("count");
    expect(role.getByText("1,480,000")).toHaveClass("count");
    expect(role.getByText("412")).toHaveClass("count");
    expect(role.getByText("100%")).toHaveClass("tag", "mute");
  });

  it("draws one row for each AI role that uses the model", async () => {
    await open([glm], { rows, reached: "", roles: riders });
    const table = tableAfter("By AI role, this month");
    expect(table.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Dispatcher",
      "Hub Steward",
      "Assets Keeper",
      "Network Watcher",
    ]);
    expect(rowOf(table, "Dispatcher").getByText("43%")).toBeInTheDocument();
  });

  it("says no AI role uses the model when none does", async () => {
    await open([glm], { rows, reached: "", roles: [] });
    expect(screen.getByText("No AI role uses this model yet.")).toBeInTheDocument();
  });

  it("says the roles could not be loaded, and keeps the limits table, when the roles could not be read", async () => {
    await open([glm], { rows, reached: "", roles: null });
    expect(tableAfter("Use against each limit").getByText("Tokens per day")).toBeInTheDocument();
    const failed = screen.getByText("The page could not be loaded.");
    expect(failed).toHaveClass("empty", "error");
  });

  it("says no limit applies yet when the model holds none", async () => {
    await open([glm], { rows: [], reached: "", roles: [] });
    expect(screen.getByText("No limit applies to this model yet. Set one in Limits.")).toHaveClass("empty");
  });
});

describe("the Usage tab when a limit is reached", () => {
  const reachedRows: LimitUse[] = rows.map((row) => (row.key === "tokens_per_month" ? { ...row, used: 4000000 } : row));
  const reached: ModelUse = {
    rows: reachedRows,
    reached: "This account's monthly token limit is reached.",
    roles: [{ ...coordinator, month: 4000000 }],
  };

  it("draws a banner with one plain sentence that opens Limits", async () => {
    await open([glm], reached);
    const banner = screen.getByRole("link", { name: /Limit reached/ });
    expect(banner).toHaveClass("tile", "warn");
    expect(banner).toHaveTextContent("This account's monthly token limit is reached.");
    expect(banner).toHaveAttribute("href", "/h/h1/models/c1/limits");
  });

  it("reads Reached on the row of that limit and a share on the others", async () => {
    await open([glm], reached);
    const table = tableAfter("Use against each limit");
    expect(rowOf(table, "Tokens per month").getByText("Reached")).toHaveClass("tag", "bad");
    expect(rowOf(table, "Tokens per day").getByText("31%")).toBeInTheDocument();
  });

  it("still marks the row Reached when the backend gave no sentence", async () => {
    await open([glm], { ...reached, reached: "" });
    expect(screen.queryByText("Limit reached")).not.toBeInTheDocument();
    expect(rowOf(tableAfter("Use against each limit"), "Tokens per month").getByText("Reached")).toBeInTheDocument();
  });
});

describe("the Usage tab for a seat that is not the owner", () => {
  it("shows a Staff seat chip and the use, with Limits and Usage but not Key and test", async () => {
    await open([glm], { rows, reached: "", roles: riders }, staff);
    expect(screen.getByText("Staff seat")).toHaveClass("tag", "mute");
    expect(screen.queryByText("Key and test")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limits" })).toBeInTheDocument();
    expect(tableAfter("By AI role, this month").getAllByRole("row")).toHaveLength(5);
  });
});

describe("the Usage tab when the model is not found or the use cannot be read", () => {
  it("says the page could not be loaded, with a way back to Models, for an address no model holds", async () => {
    await open([glm], within_limits, owner, "c9");
    expect(screen.getByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(screen.getByRole("link", { name: "Back to Models" })).toHaveAttribute("href", "/h/h1/models");
    expect(modelUsage).not.toHaveBeenCalled();
  });

  it("says the page could not be loaded when the models cannot be listed", async () => {
    await open(new Error('unknown tool "ai_list_accounts"'));
    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(modelUsage).not.toHaveBeenCalled();
  });

  it("says the page could not be loaded when the use cannot be read, under the tabs", async () => {
    await open([glm], new Error('unknown tool "ai_list_usage"'));
    expect(screen.getByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limits" })).toBeInTheDocument();
  });
});

describe("the Usage tab of one model in a hub with several", () => {
  it("is titled with that model and reads and draws the use of that model alone", async () => {
    await open([glm, sonnet], within_limits, owner, sonnet.id);
    expect(screen.getByRole("heading", { level: 1, name: "Claude · Sonnet 5.5" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Hugging Face · GLM-5.3" })).not.toBeInTheDocument();
    expect(modelUsage).toHaveBeenCalledTimes(1);
    expect(modelUsage).toHaveBeenCalledWith("h1", sonnet);
    expect(screen.getAllByRole("heading", { level: 2, name: "Use against each limit" })).toHaveLength(1);
  });
});

describe("the link from a model's Usage tab to all usage", () => {
  it("opens the Usage Overview for the manager", async () => {
    await open([glm]);
    expect(screen.getByRole("link", { name: "See all usage" })).toHaveAttribute("href", "/h/h1/usage-overview");
  });

  it("is left out for a staff seat, who does not see the Usage pages", async () => {
    await open([glm], within_limits, staff);
    expect(screen.queryByRole("link", { name: "See all usage" })).not.toBeInTheDocument();
  });
});
