import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { callTool, listTools } from "../../wakala/mcp";
import { roleLimitKeys } from "../../data/roleLimits";
import { RoleLimitsForm } from "./RoleLimitsForm";

vi.mock("../../wakala/mcp");

const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const farmers = {
  id: "r1",
  name: "Farmers' agent",
  account_id: "c1",
  tokens_per_call: 8000,
  tokens_per_day: 100000,
  tokens_per_week: null,
  tokens_per_month: 2000000,
  requests_per_minute: 30,
  requests_per_day: null,
  requests_per_week: null,
  tokens_per_test: 50000,
  scenarios_at_once: 2,
};

const suppliers = { ...farmers, id: "r2", name: "Suppliers' agent", tokens_per_day: 40000 };

const offeredTool = {
  name: "ai_set_role_limits",
  description: "Set AI role limits",
  inputSchema: {
    type: "object",
    properties: {
      roleID: { type: "string" },
      tokens_per_call: { type: ["integer", "null"] },
      tokens_per_day: { type: ["integer", "null"] },
    },
    required: ["roleID"],
  },
};

const answers = (replies: Record<string, unknown> = {}) => {
  vi.mocked(listTools).mockResolvedValue([offeredTool]);
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
    if (tool === "ai_list_roles") return { items: [farmers, suppliers] } as never;
    if (tool === "ai_get_role") return farmers as never;
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return (reply ?? {}) as never;
  });
};

const sent = () => vi.mocked(callTool).mock.calls.filter((call) => call[1] === "ai_set_role_limits");

const shown = vi.fn();
const closed = vi.fn();

const open = async (props: Partial<Parameters<typeof RoleLimitsForm>[0]> = {}) => {
  render(
    <I18nProvider initial={words}>
      <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
        <NoticeCtx.Provider value={{ message: null, show: shown, dismiss: () => {} }}>
          <RoleLimitsForm limit="tokens_per_day" onClose={closed} {...props} />
        </NoticeCtx.Provider>
      </ConsoleCtx.Provider>
    </I18nProvider>,
  );
  await screen.findByRole("button", { name: "Save" });
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(listTools).mockReset();
  shown.mockReset();
  closed.mockReset();
  answers();
});

describe("the form that changes one limit of an AI role", () => {
  it("is drawn from the tool's input schema with the agent and the one limit, and names the tool", async () => {
    await open({ role: "r1" });
    expect(screen.getByText("ai_set_role_limits")).toHaveClass("form-tool");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.queryByRole("spinbutton", { name: /tokens_per_call/ })).toBeNull();
  });

  it("labels the agent and the limit in words and presses Save, not Submit", async () => {
    await open({ role: "r1" });
    expect(screen.getByRole("combobox", { name: /^Agent/ })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Tokens per day" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("offers every AI role of the hub by name", async () => {
    await open({ role: "r1" });
    const options = [...screen.getByRole("combobox").querySelectorAll("option")].map((option) => option.textContent);
    expect(options).toEqual(["Farmers' agent", "Suppliers' agent"]);
  });

  it("starts on the agent the chat named, showing the limit it holds", async () => {
    await open({ role: "r1" });
    expect(screen.getByRole("combobox")).toHaveValue("r1");
    expect(screen.getByRole("spinbutton")).toHaveValue(100000);
  });

  it("starts on the value the chat suggested instead of the one held", async () => {
    await open({ role: "r1", value: 150000 });
    expect(screen.getByRole("spinbutton")).toHaveValue(150000);
  });

  it("saves the one changed limit with the other eight the role holds, then closes and says so", async () => {
    await open({ role: "r1", value: 150000 });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(closed).toHaveBeenCalled());
    expect(sent()).toHaveLength(1);
    expect(sent()[0][2]).toEqual({
      roleID: "r1",
      tokens_per_call: 8000,
      tokens_per_day: 150000,
      tokens_per_week: null,
      tokens_per_month: 2000000,
      requests_per_minute: 30,
      requests_per_day: null,
      requests_per_week: null,
      tokens_per_test: 50000,
      scenarios_at_once: 2,
    });
    expect(shown).toHaveBeenCalledWith("The limits were saved.");
  });

  it("saves another agent's limit when the agent is changed", async () => {
    await open({ role: "r1", value: 150000 });
    await userEvent.selectOptions(screen.getByRole("combobox"), "r2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(closed).toHaveBeenCalled());
    expect(sent()[0][2]).toMatchObject({ roleID: "r2", tokens_per_day: 150000 });
  });

  it("records nothing until Save and closes on Cancel", async () => {
    await open({ role: "r1", value: 150000 });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(closed).toHaveBeenCalled();
    expect(sent()).toEqual([]);
  });

  it("stays open and says the change could not be sent when the save fails", async () => {
    answers({ ai_set_role_limits: new Error("refused") });
    await open({ role: "r1", value: 150000 });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(closed).not.toHaveBeenCalled();
    expect(shown).not.toHaveBeenCalled();
  });

  it("says it could not be loaded when the hub does not offer the tool", async () => {
    vi.mocked(listTools).mockResolvedValue([]);
    render(
      <I18nProvider initial={words}>
        <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
          <RoleLimitsForm limit="tokens_per_day" onClose={closed} />
        </ConsoleCtx.Provider>
      </I18nProvider>,
    );
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
  });
});

describe("the words of the role-limit form", () => {
  const languages = Object.keys(words) as (keyof typeof words)[];
  const table = (language: keyof typeof words) => words[language] as Record<string, string>;

  it.each(languages)("has a label for the agent and for each of the nine limits in %s, none of them the raw name", (language) => {
    for (const name of ["roleID", ...roleLimitKeys]) {
      expect(table(language)["field." + name], `${language} field.${name}`).toBeTruthy();
      expect(table(language)["field." + name]).not.toBe(name);
    }
  });
});
