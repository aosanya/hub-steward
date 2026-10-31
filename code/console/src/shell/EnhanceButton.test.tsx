import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maxBackgroundLength, partsOfPage } from "../data/enhanceBackground";
import { I18nProvider } from "../i18n";
import { english, hubRow } from "../pages/spec/profileTesting";
import { TitleRow } from "../ui";
import { callTool } from "../wakala/mcp";
import { ChatAskCtx } from "./chatTell";
import { ConsoleCtx } from "./context";

vi.mock("../wakala/mcp");

const sentence = (page: string) =>
  `Review the ${page} and make suggestions where something is missing, unclear or can be improved.`;

const listed: Record<string, unknown[]> = {
  agency_list_goals: [{ id: "g1", title: "Sell produce together" }],
  agency_list_roles: [{ id: "r1", name: "Treasurer" }],
  agency_list_workflows: [{ id: "w1", name: "Weekly order" }],
  agency_list_objectives: [{ id: "o1", title: "Collect orders" }],
};

const answerWith = (lists: Record<string, unknown[]>) =>
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }] } as never;
    return { items: lists[tool] ?? [] } as never;
  });

const toolsRead = () => vi.mocked(callTool).mock.calls.map((call) => call[1]).filter((tool) => tool !== "agency_list_drafts");

const show = (page: string, ask = vi.fn(), search = "") => {
  render(
    <I18nProvider initial={english}>
      <MemoryRouter initialEntries={[`/hub/h1/${page}${search}`]}>
        <ConsoleCtx.Provider value={{ hub: hubRow, page, setBadges: () => {}, refreshMenu: () => {} }}>
          <ChatAskCtx.Provider value={ask}>
            <TitleRow title="Title" />
          </ChatAskCtx.Provider>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return ask;
};

const press = async (ask: ReturnType<typeof vi.fn>) => {
  await userEvent.click(screen.getByRole("button", { name: "Enhance" }));
  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  return ask.mock.calls[0] as [string, string];
};

describe("the Enhance button", () => {
  beforeEach(() => {
    vi.mocked(callTool).mockReset();
    answerWith(listed);
  });

  it.each(["objectives", "workflows", "goals", "bowties"])("asks the chat to review the %s page", async (page) => {
    const [text] = await press(show(page));
    expect(text).toBe(sentence(page));
  });

  it("shows the spinner and stays pressed until the chat has settled", async () => {
    let settled: (() => void) | undefined;
    const ask = vi.fn((_text: string, _background?: string, _afterChange?: () => void, done?: () => void) => {
      settled = done;
    });
    show("objectives", ask);
    const button = screen.getByRole("button", { name: "Enhance" });
    expect(button.querySelector(".tool-spin")).toBeNull();

    await userEvent.click(button);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(button.querySelector(".tool-spin")).not.toBeNull();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    act(() => settled?.());
    expect(button.querySelector(".tool-spin")).toBeNull();
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toBeEnabled();
  });

  it("cannot be pressed again until the chat has settled with the first press", async () => {
    const done: (() => void)[] = [];
    const ask = vi.fn((_text: string, _background?: string, _afterChange?: () => void, settled?: () => void) => {
      if (settled) done.push(settled);
    });
    show("objectives", ask);
    const button = screen.getByRole("button", { name: "Enhance" });

    await userEvent.click(button);
    await userEvent.click(button);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask).toHaveBeenCalledTimes(1);

    act(() => done[0]());
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
  });

  it.each(["status", "publish", "test", "models", "approvals", "users"])("is absent on the %s page", (page) => {
    show(page);
    expect(screen.queryByRole("button", { name: "Enhance" })).toBeNull();
  });

  it("is absent while an item or a form is open on an agency page", () => {
    show("objectives", vi.fn(), "?add=objective");
    expect(screen.queryByRole("button", { name: "Enhance" })).toBeNull();
  });

  it("is absent outside the console frame", () => {
    render(
      <I18nProvider initial={english}>
        <MemoryRouter>
          <TitleRow title="Title" />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.queryByRole("button", { name: "Enhance" })).toBeNull();
  });

  it("carries the goals, roles and workflows of the draft with the objectives review, and only the sentence is visible", async () => {
    const [text, background] = await press(show("objectives"));
    expect(text).toBe(sentence("objectives"));
    expect(text).not.toContain("Treasurer");
    expect(background).toContain("Sell produce together");
    expect(background).toContain("Treasurer");
    expect(background).toContain("Weekly order");
    expect(background).toContain("Collect orders");
    expect(toolsRead()).toEqual(
      expect.arrayContaining(["agency_list_goals", "agency_list_roles", "agency_list_workflows", "agency_list_modules"]),
    );
    expect(toolsRead()).toHaveLength(partsOfPage.objectives.length);
  });

  it("reads the draft that is open", async () => {
    await press(show("workflows"));
    expect(vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_roles")[0][2]).toMatchObject({ draft_id: "d1" });
  });

  it("carries the roles, records and objectives with the workflows review", async () => {
    const [, background] = await press(show("workflows"));
    expect(background).toContain("Treasurer");
    expect(background).toContain("Collect orders");
    expect(toolsRead()).toEqual(expect.arrayContaining(["agency_list_roles", "agency_list_records", "agency_list_objectives"]));
  });

  it("trims a large draft to the bound", async () => {
    const many = Array.from({ length: 500 }, (_, index) => ({ id: `g${index}`, title: "Goal ".repeat(40) + index }));
    answerWith({ ...listed, agency_list_goals: many, agency_list_objectives: many, agency_list_roles: many });
    const [, background] = await press(show("objectives"));
    expect(background.length).toBeLessThanOrEqual(maxBackgroundLength + partsOfPage.objectives.length * 40);
    expect(background).toContain("more not shown");
    expect(background).toContain("goals (500):");
  });

  it("sends the sentence alone when the draft cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));
    const [text, background] = await press(show("roles"));
    expect(text).toBe(sentence("roles"));
    expect(background).toBe("");
  });
});
