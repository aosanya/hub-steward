import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { BacklogsPage } from "./BacklogsPage";
import { hubBacklogsOf, backlogOf, taskTools } from "../shared/api";
import { forgetWidth, setWide } from "../../inbox/fakeWidth";

const step = (name: string, issues: number) => ({ id: name.toLowerCase(), name, issues });

const reply = (archived: boolean) => ({
  items: [
    { id: "backlog", name: "Backlog", issues: 3, steps: [step("To do", 3)] },
    { id: "app-navigation-redesign", name: "App navigation redesign", issues: 25, steps: [step("Archive", 25)], ...(archived ? { archived: true } : {}) },
  ],
});

const answering = (archived: boolean) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
    if (tool === taskTools.backlogs) return reply(archived);
    return { items: [], modules: [] };
  }) as never);

const openList = () =>
  render(
    <MemoryRouter>
      <BacklogsPage manage={{ mayManage: async () => false } as never} />
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("archived backlogs on the Backlogs list", () => {
  it("reads the archived mark of a backlog from the list reply", () => {
    const [plain, archived] = hubBacklogsOf(reply(true)).map(backlogOf);
    expect(plain.archived).toBeUndefined();
    expect(archived.archived).toBe(true);
  });

  it("hides an archived backlog and brings it back with Show archived, marked Archived", async () => {
    answering(true);
    openList();
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
    expect(screen.queryByText("App navigation redesign")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    expect(await screen.findByText("App navigation redesign")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    await waitFor(() => expect(screen.queryByText("App navigation redesign")).not.toBeInTheDocument());
  });

  it("offers no Show archived toggle while nothing is archived", async () => {
    answering(false);
    openList();
    expect(await screen.findByText("App navigation redesign")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Show archived" })).not.toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });
});

const openListAs = (mayManage: boolean) =>
  render(
    <MemoryRouter>
      <BacklogsPage manage={{ mayManage: async () => mayManage } as never} />
    </MemoryRouter>,
  );

describe.each([
  { screen: "phone", wide: false },
  { screen: "wide screen", wide: true },
])("archived backlogs and access levels on a $screen", ({ wide }) => {
  afterEach(forgetWidth);

  it("hides an archived backlog until Show archived is ticked, then marks it Archived", async () => {
    setWide(wide);
    answering(true);
    openListAs(false);
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
    expect(screen.queryByText("App navigation redesign")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    expect(await screen.findByText("App navigation redesign")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("draws the Show archived toggle in the frame's main pane on a wide screen and in the plain list on a phone", async () => {
    setWide(wide);
    answering(true);
    openListAs(false);
    const toggle = await screen.findByRole("checkbox", { name: "Show archived" });
    expect(Boolean(toggle.closest(".wf-main"))).toBe(wide);
    expect(Boolean(document.querySelector(".wf"))).toBe(wide);
  });

  it("offers Add a backlog to a member who may manage backlogs", async () => {
    setWide(wide);
    answering(true);
    openListAs(true);
    expect(await screen.findByRole("button", { name: "Add a backlog" })).toBeInTheDocument();
  });

  it("offers no Add a backlog to a member who may not manage backlogs, and still lists the backlogs and the toggle", async () => {
    setWide(wide);
    answering(true);
    openListAs(false);
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show archived" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a backlog" })).not.toBeInTheDocument();
  });
});
