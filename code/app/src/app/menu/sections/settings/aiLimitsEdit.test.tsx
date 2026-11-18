import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { settingsPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[] = [];

const answer = async (name: string) => {
  switch (name) {
    case "agency_list_mounts":
      return { modules: [{ module: "ai" }] };
    case "agency_get_my_roles":
      return { permissions };
    case "ai_list_roles":
      return { items: [{ id: "r1", name: "Council helper", status: "active", description: "Reads the agenda", tokens_per_day: 500, requests_per_minute: 12 }] };
    case "ai_get_assistant_limits":
      return { tokens_per_person_day: 100, tokens_per_person_month: 3000, owner_tokens_per_person_day: 0, owner_tokens_per_person_month: 90000 };
    case "ai_usage_breakdown":
      return { rows: [] };
    default:
      return { items: [] };
  }
};

const Where = () => {
  const at = useLocation();
  return <p data-testid="where">{`${at.pathname}${at.search}`}</p>;
};

beforeEach(() => {
  openAgency("town");
  permissions = [];
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const aiPath = () => items.find((item) => item.title === "AI Agents & Limits")?.path?.() ?? "";

const openAt = async (path: string, name?: string) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (name) await screen.findByRole("heading", { level: 1, name });
};

const writes = () => vi.mocked(mcp.callTool).mock.calls.filter(([, name]) => name === "ai_set_role_limits" || name === "ai_set_assistant_limits");

describe("an AI agent's Limits card has Edit limits in its footer", () => {
  it("names Edit limits only for who may manage AI roles and limits", async () => {
    permissions = ["ai.role.manage"];
    await openAt(`${aiPath()}?item=r1`, "Council helper");
    const card = await screen.findByRole("region", { name: "Limits" });
    expect(within(card).getByRole("button", { name: "Edit limits" })).toBeInTheDocument();
  });

  it("hides Edit limits from someone without that permission", async () => {
    await openAt(`${aiPath()}?item=r1`, "Council helper");
    const card = await screen.findByRole("region", { name: "Limits" });
    expect(within(card).queryByRole("button", { name: "Edit limits" })).not.toBeInTheDocument();
  });

  it("opens one screen filled from the agent, and Save replaces all nine limits and returns to the agent", async () => {
    permissions = ["ai.role.manage"];
    await openAt(`${aiPath()}?item=r1`, "Council helper");
    const card = await screen.findByRole("region", { name: "Limits" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit limits" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/ai-agents/r1/edit");
    const perDay = await screen.findByLabelText("Tokens per day");
    expect(perDay).toHaveValue("500");
    expect(screen.getByLabelText("Requests per minute")).toHaveValue("12");
    expect(screen.getByLabelText("Tokens per call")).toHaveValue("0");
    await userEvent.clear(perDay);
    await userEvent.type(perDay, "700");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mcp.callTool).toHaveBeenCalledWith("", "ai_set_role_limits", {
        roleID: "r1",
        tokens_per_call: 0,
        tokens_per_day: 700,
        tokens_per_week: 0,
        tokens_per_month: 0,
        requests_per_minute: 12,
        requests_per_day: 0,
        requests_per_week: 0,
        tokens_per_test: 0,
        scenarios_at_once: 0,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/ai-agents?item=r1"));
  });

  it("refuses a negative or fractional number without calling the tool", async () => {
    permissions = ["ai.role.manage"];
    await openAt(settingsPaths.aiAgentEdit.path({ id: "r1" }));
    const perDay = await screen.findByLabelText("Tokens per day");
    await userEvent.clear(perDay);
    await userEvent.type(perDay, "-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Use whole numbers, 0 or more. Zero means no limit.")).toBeInTheDocument();
    await userEvent.clear(perDay);
    await userEvent.type(perDay, "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use whole numbers, 0 or more. Zero means no limit.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it("opens no form for someone without the permission", async () => {
    await openAt(settingsPaths.aiAgentEdit.path({ id: "r1" }));
    await screen.findByText("Edit limits");
    expect(screen.queryByLabelText("Tokens per day")).not.toBeInTheDocument();
  });
});

describe("the Each person page has Edit limits for the assistant limits", () => {
  it("names Edit limits only for who may manage AI accounts", async () => {
    permissions = ["ai.account.manage"];
    await openAt(`${aiPath()}?item=everyone`, "Each person");
    const card = await screen.findByRole("region", { name: "Limits" });
    expect(within(card).getByRole("button", { name: "Edit limits" })).toBeInTheDocument();
  });

  it("opens the four person limits filled, and Save replaces all four", async () => {
    permissions = ["ai.account.manage"];
    await openAt(`${aiPath()}?item=everyone`, "Each person");
    const card = await screen.findByRole("region", { name: "Limits" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit limits" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/ai-agents/everyone/edit");
    const day = await screen.findByLabelText("Each person a day");
    expect(day).toHaveValue("100");
    expect(screen.getByLabelText("The owner a day")).toHaveValue("0");
    expect(screen.queryByLabelText("Tokens per call")).not.toBeInTheDocument();
    await userEvent.clear(day);
    await userEvent.type(day, "250");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mcp.callTool).toHaveBeenCalledWith("", "ai_set_assistant_limits", {
        tokens_per_person_day: 250,
        tokens_per_person_month: 3000,
        owner_tokens_per_person_day: 0,
        owner_tokens_per_person_month: 90000,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/ai-agents?item=everyone"));
  });
});
