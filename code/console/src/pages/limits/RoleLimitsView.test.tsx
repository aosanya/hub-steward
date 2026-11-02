import { render, screen, waitFor } from "@testing-library/react";
import words from "../../../public/i18n.json";
import type { ComponentType } from "react";
import { I18nProvider } from "../../i18n";
import type { ActionViewProps } from "../../shell/actionViews";
import { ConsoleCtx } from "../../shell/context";
import type { Hub } from "../../types";
import { callTool, listTools } from "../../wakala/mcp";
import { RoleLimitsView } from "./RoleLimitsView";

vi.mock("../../wakala/mcp");

const Shown: ComponentType<ActionViewProps> = RoleLimitsView;

const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const role = { id: "r1", name: "Farmers' agent", tokens_per_day: 100000 };

const suppliers = { id: "r2", name: "Suppliers' agent", tokens_per_day: 40000 };

const show = async (params: Record<string, unknown>) => {
  vi.mocked(listTools).mockResolvedValue([
    { name: "ai_set_role_limits", description: "Set", inputSchema: { type: "object", properties: { roleID: { type: "string" } }, required: ["roleID"] } },
  ]);
  vi.mocked(callTool).mockResolvedValue({ items: [role] } as never);
  render(
    <I18nProvider initial={words}>
      <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
        <Shown hubId="h1" title="" params={params} onDone={() => {}} />
      </ConsoleCtx.Provider>
    </I18nProvider>,
  );
};

describe("the role-limit view the chat opens in the content area", () => {
  it("draws the form for the limit the chat named, on the agent it named", async () => {
    await show({ role: "r1", limit: "tokens_per_day", value: 150000 });
    expect(await screen.findByRole("combobox")).toHaveValue("r1");
    expect(screen.getByRole("spinbutton")).toHaveValue(150000);
  });

  it("says it could not be loaded when the chat named no known limit", async () => {
    await show({ role: "r1", limit: "tokens_per_hour" });
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("draws the second request of the same chat for the second agent and value, not the first", async () => {
    vi.mocked(listTools).mockResolvedValue([
      { name: "ai_set_role_limits", description: "Set", inputSchema: { type: "object", properties: { roleID: { type: "string" } }, required: ["roleID"] } },
    ]);
    vi.mocked(callTool).mockResolvedValue({ items: [role, suppliers] } as never);
    const view = (params: Record<string, unknown>) => (
      <I18nProvider initial={words}>
        <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
          <Shown hubId="h1" title="" params={params} onDone={() => {}} />
        </ConsoleCtx.Provider>
      </I18nProvider>
    );
    const { rerender } = render(view({ role: "r1", limit: "tokens_per_day", value: 150000 }));
    expect(await screen.findByRole("combobox")).toHaveValue("r1");
    expect(screen.getByRole("spinbutton")).toHaveValue(150000);

    rerender(view({ role: "r2", limit: "tokens_per_day", value: 50000 }));

    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("r2"));
    expect(screen.getByRole("spinbutton")).toHaveValue(50000);
  });
});
