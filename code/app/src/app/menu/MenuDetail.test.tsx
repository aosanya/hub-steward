import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { actionFailedWords, MenuDetail } from "./MenuDetail";

const tool = "agency_get_issue";

const action = { label: "Close issue", tool: "agency_close_issue" };

const fields = { Reporter: "reporter", Place: "place", Notes: "notes" };

const issue = { id: "i1", name: "Bridge repair", status: "Open", reporter: "Amina", place: "Main Street", notes: "" };

const origin = { path: "/a/town/menu/issues/all", title: "All Issues" };

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockResolvedValue(issue);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const detail = (entry: string | { pathname: string; state: unknown } = { pathname: "/a/town/menu/issues/i1", state: { from: origin } }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/:id" element={<MenuDetail title="Issue" tool={tool} fields={fields} status="status" action={action} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the shared menu detail", () => {
  it("draws each field the tool supplied with its label and value", async () => {
    detail();

    expect(await screen.findByText("Reporter")).toBeInTheDocument();
    expect(screen.getByText("Amina")).toBeInTheDocument();
    expect(screen.getByText("Place")).toBeInTheDocument();
    expect(screen.getByText("Main Street")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Issue" })).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", tool, { id: "i1" });
  });

  it("does not draw a field the tool left empty or did not supply", async () => {
    called.mockResolvedValue({ id: "i1", status: "Open", reporter: "Amina", notes: "" });
    detail();
    await screen.findByText("Amina");

    expect(screen.queryByText("Place")).toBeNull();
    expect(screen.queryByText("Notes")).toBeNull();
  });

  it("shows the status the tool supplied", async () => {
    detail();

    expect(await screen.findByText("Open")).toBeInTheDocument();
  });

  it("reads the item from an item key when the tool wraps it", async () => {
    called.mockResolvedValue({ item: issue });
    detail();

    expect(await screen.findByText("Main Street")).toBeInTheDocument();
  });

  it("calls the named action tool for this item when the action button is pressed", async () => {
    detail();
    await screen.findByText("Amina");

    await userEvent.click(screen.getByRole("button", { name: action.label }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", action.tool, { id: "i1" }));
  });

  it("says so when the action tool fails", async () => {
    detail();
    await screen.findByText("Amina");
    called.mockRejectedValueOnce(new Error("no"));

    await userEvent.click(screen.getByRole("button", { name: action.label }));

    expect(await screen.findByText(actionFailedWords)).toBeInTheDocument();
  });

  it("has a Back button that reads the name of the screen the person came from and goes there", async () => {
    detail();
    await screen.findByText("Amina");

    await userEvent.click(screen.getByRole("button", { name: /All Issues/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });
});
