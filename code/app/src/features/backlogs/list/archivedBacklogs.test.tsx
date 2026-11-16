import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { BacklogsPage } from "./BacklogsPage";
import { hubBacklogsOf, backlogOf, taskTools } from "../shared/api";

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
