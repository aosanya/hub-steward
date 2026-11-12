import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { IssuePage } from "./IssuePage";
import { IssueCard } from "./IssueCard";
import { issueOf, mcpBacklogsClient, taskTools, type BacklogsClient, type Issue, type IssueDetail, type NotesClient } from "./api";

const issue = (over: Partial<Issue>): Issue => ({ id: "1", title: "SW9 Write the manual", description: "Body.", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "Ready", rank: 1, priority: "medium", ...over });

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const pageWith = (effort: string, setEffort: BacklogsClient["setEffort"]) => {
  let current: IssueDetail = { ...issue({ effort }), waitsOn: [], waitedOnBy: [] };
  const client: BacklogsClient = {
    backlogs: async () => [],
    issues: async () => [],
    issue: async () => current,
    setEffort: async (id, value) => {
      await setEffort?.(id, value);
      current = { ...current, effort: value };
    },
  };
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} todosClient={{ list: async () => [] }} />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => vi.restoreAllMocks());

describe("the effort of an issue on the issue page", () => {
  it("shows the effort in words, and 'Effort: Unknown' while it is unknown", async () => {
    pageWith("very_high", async () => undefined);
    expect(await screen.findByRole("button", { name: /Effort: Very high/ })).toBeInTheDocument();
  });

  it("offers the six values and sets the one chosen, then shows it", async () => {
    const set = vi.fn(async () => undefined);
    pageWith("unknown", set);
    await userEvent.click(await screen.findByRole("button", { name: /^Effort: Unknown/ }));
    const words = ["Very low", "Low", "Medium", "High", "Very high", "Unknown"];
    expect(screen.getAllByRole("button").filter((one) => words.includes(one.textContent ?? "")).map((one) => one.textContent)).toEqual(words);
    await userEvent.click(screen.getByRole("button", { name: "Very low" }));
    expect(set).toHaveBeenCalledWith("1", "very_low");
    expect(await screen.findByRole("button", { name: /Effort: Very low/ })).toBeInTheDocument();
  });

  it("puts the effort pill in the chip row at the bottom of the card, not in the header", async () => {
    pageWith("high", async () => undefined);
    const header = (await screen.findByText("SW9", { selector: ".issue-code" })).closest(".card-head") as HTMLElement;
    expect(header).not.toHaveTextContent("Effort");
    expect(document.querySelector(".issue-main .issue-tags")).toHaveTextContent("Effort: High");
  });

  it("says the effort was not changed when the hub refuses it", async () => {
    pageWith("low", async () => Promise.reject(new Error("refused")));
    await userEvent.click(await screen.findByRole("button", { name: /Effort: Low/ }));
    await userEvent.click(screen.getByRole("button", { name: "High" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The effort was not changed.");
  });
});

describe("the effort on a card and a row", () => {
  it("shows a known effort as a chip in the chip row with the tags, the header keeping only the code", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ effort: "high", priority: "critical" })} chosen={[]} onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelector(".issue-line")).toHaveTextContent("Effort: High");
    const head = document.querySelector(".card-head") as HTMLElement;
    expect(document.querySelector(".issue-line")).toHaveTextContent("Priority: Critical");
    expect(head).not.toHaveTextContent(/Priority|Effort/);
  });

  it("shows no chip when the effort is unknown or missing", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ effort: "unknown" })} chosen={[]} onOpen={() => undefined} />
        <IssueCard issue={issue({ id: "2" })} chosen={[]} onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.body).not.toHaveTextContent("Effort");
  });

  it("sets the effort from the pill in a row's chip row and says so when the hub refuses", async () => {
    const set = vi.fn(async () => Promise.reject(new Error("refused")));
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ effort: "low" })} chosen={[]} onOpen={() => undefined} onEffort={set} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Effort: Low/ }));
    await userEvent.click(screen.getByRole("button", { name: "Very high" }));
    expect(set).toHaveBeenCalledWith("very_high");
    expect(await screen.findByRole("alert")).toHaveTextContent("The effort was not changed.");
  });
});

describe("the hub", () => {
  it("reads the effort of an issue", () => {
    expect(issueOf({ id: "1", effort: "very_low" }).effort).toBe("very_low");
    expect(issueOf({ id: "1" }).effort).toBeUndefined();
  });

  it("patches only the effort of the issue", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    await mcpBacklogsClient.setEffort?.("1", "very_high");
    expect(call).toHaveBeenCalledWith("", taskTools.patch, { taskID: "1", effort: "very_high" });
  });
});
