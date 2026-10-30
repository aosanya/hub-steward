import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { callTool } from "../../wakala/mcp";
import { AddScenarioForm } from "./ScenarioForm";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const words = JSON.parse(
  readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"),
);

const call = vi.mocked(callTool);

const lab: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_workflows: {
    items: [
      { id: "w1", name: "Buy now" },
      { id: "w2", name: "Group order" },
    ],
  },
  agency_list_work_items: {
    items: [{ id: "s1", workflow_id: "w2", title: "Start", role_id: "r1" }],
  },
  agency_list_pickers: {
    actors: [
      { id: "r1", name: "Group coordinator", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: ["free_text"],
  },
};

const writes = () =>
  call.mock.calls.filter(([, name]) =>
    /^agency_(create|update|delete|propose)_/.test(String(name)),
  );

beforeEach(() => {
  call.mockReset();
  call.mockImplementation((async (_hub: string, tool: string) =>
    tool in lab ? lab[tool] : { items: [] }) as typeof callTool);
});

const fill = {
  name: "Group order: a farmer stays silent",
  summary: "The order waits until the group coordinator decides",
  workflow: "Group order",
  actors: [{ name: "Farmer 2", role: "Farmer" }],
};

const open = () =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter>
        <AddScenarioForm
          hubId="h1"
          fill={fill}
          onOutcome={() => {}}
          onCancel={() => {}}
        />
      </MemoryRouter>
    </I18nProvider>,
  );

describe("Add a scenario filled by the chat", () => {
  it("lands with the name, the workflow and what it tries filled", async () => {
    open();

    expect(await screen.findByLabelText(/Name/)).toHaveValue(
      "Group order: a farmer stays silent",
    );
    expect(await screen.findByDisplayValue("Group order")).toBeInTheDocument();
    expect(screen.getByLabelText(/What it tries/)).toHaveValue(
      "The order waits until the group coordinator decides",
    );
  });

  it("carries the extra actor to the Actors tab and records nothing until Save", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByDisplayValue("Group order");
    await user.click(screen.getByRole("button", { name: "Actors" }));

    expect(await screen.findByDisplayValue("Farmer 2")).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });
});
