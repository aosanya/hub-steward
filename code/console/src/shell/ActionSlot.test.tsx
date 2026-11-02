import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalAction, formAction, listAction } from "../data/chatActions";
import type { ActionAnswer } from "../data/chatAnswer";
import { NoticeCtx, type NoticeApi } from "../ui/noticeContext";
import { callTool, listTools } from "../wakala/mcp";
import { ActionSlot } from "./ActionSlot";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const setLimits = {
  name: "ai_set_limits",
  description: "Set the limits",
  inputSchema: {
    type: "object",
    properties: { instance_id: { type: "string" }, tokens_per_day: { type: "integer", description: "Tokens per day" }, note: { type: "string" } },
    required: ["instance_id", "tokens_per_day"],
  },
};

const raise: ActionAnswer = formAction("Raise the daily tokens", "Raise the daily tokens", {
  tool: "ai_set_limits",
  show: ["tokens_per_day"],
  initial: { tokens_per_day: 100000 },
  fixed: { account_id: "acc-1" },
  notice: "The limits were saved.",
});

const approve: ActionAnswer = approvalAction("Raise the daily tokens", "Allow 200,000 tokens a day", {
  tool: "ai_set_limits",
  arguments: { account_id: "acc-1", tokens_per_day: 200000 },
  text: "The Farmers' agent stopped at 100,000.",
  notice: "The raise was approved.",
});

const shown: string[] = [];

const notices: NoticeApi = { message: null, show: (text) => shown.push(text), dismiss: () => {} };

function Host({ answer }: { answer: ActionAnswer }) {
  const [cleared, setCleared] = useState(false);
  return (
    <NoticeCtx.Provider value={notices}>
      {cleared ? <p>cleared</p> : <ActionSlot hubId="siaya" answer={answer} onClear={() => setCleared(true)} />}
    </NoticeCtx.Provider>
  );
}

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([setLimits]);
  callToolMock.mockResolvedValue({});
  shown.length = 0;
});

describe("a form the chat puts in the content area", () => {
  it("is drawn from the tool's input schema under the prompt and starts on the values it was given", async () => {
    render(<Host answer={raise} />);

    const field = await screen.findByLabelText(/tokens.per.day/i);
    expect(field).toHaveValue(100000);
    expect(screen.getByText("Raise the daily tokens", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/note/i)).toBeNull();
  });

  it("calls the tool on Save with the fixed values and the typed ones, says it was saved and clears itself", async () => {
    render(<Host answer={raise} />);

    const field = await screen.findByLabelText(/tokens.per.day/i);
    await userEvent.clear(field);
    await userEvent.type(field, "200000");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    await screen.findByText("cleared");
    expect(callToolMock).toHaveBeenCalledWith("siaya", "ai_set_limits", { account_id: "acc-1", tokens_per_day: 200000 });
    expect(shown).toEqual(["The limits were saved."]);
  });

  it("stays open with the tool's own refusal when the tool fails", async () => {
    callToolMock.mockRejectedValue(new Error("ai_set_limits: above the model's maximum"));
    render(<Host answer={raise} />);

    await screen.findByLabelText(/tokens.per.day/i);
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("above the model's maximum");
    expect(screen.queryByText("cleared")).toBeNull();
    expect(shown).toEqual([]);
  });

  it("clears without calling anything on Cancel", async () => {
    render(<Host answer={raise} />);

    await screen.findByLabelText(/tokens.per.day/i);
    await userEvent.click(screen.getByRole("button", { name: "cancel" }));

    await screen.findByText("cleared");
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("says it could not load when the hub does not offer the tool", async () => {
    listToolsMock.mockResolvedValue([]);
    render(<Host answer={raise} />);

    expect(await screen.findByText("loadFailed")).toBeInTheDocument();
  });
});

describe("an approvable card the chat puts in the content area", () => {
  it("shows the card with Approve and Decline and records nothing until Approve", async () => {
    render(<Host answer={approve} />);

    expect(screen.getByText("Allow 200,000 tokens a day")).toBeInTheDocument();
    expect(screen.getByText("The Farmers' agent stopped at 100,000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "approve" })).toBeInTheDocument();
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("calls the tool once on Approve, says so and clears itself", async () => {
    render(<Host answer={approve} />);

    await userEvent.click(screen.getByRole("button", { name: "approve" }));

    await screen.findByText("cleared");
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock).toHaveBeenCalledWith("siaya", "ai_set_limits", { account_id: "acc-1", tokens_per_day: 200000 });
    expect(shown).toEqual(["The raise was approved."]);
  });

  it("calls the tool once however often Approve is pressed while it runs", async () => {
    callToolMock.mockReturnValue(new Promise(() => {}));
    render(<Host answer={approve} />);

    await userEvent.click(screen.getByRole("button", { name: "approve" }));
    await userEvent.click(screen.getByRole("button", { name: "approve" }));

    expect(callToolMock).toHaveBeenCalledTimes(1);
  });

  it("clears without calling anything on Decline", async () => {
    render(<Host answer={approve} />);

    await userEvent.click(screen.getByRole("button", { name: "decline" }));

    await screen.findByText("cleared");
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("stays open and reports the failure when the tool refuses", async () => {
    callToolMock.mockRejectedValue(new Error("above the maximum"));
    const errors: string[] = [];
    render(
      <NoticeCtx.Provider value={{ ...notices, show: (text, kind) => errors.push(`${kind}:${text}`) }}>
        <ActionSlot hubId="siaya" answer={approve} onClear={() => errors.push("cleared")} />
      </NoticeCtx.Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(errors).toEqual(["bad:above the maximum"]));
    expect(screen.getByRole("button", { name: "approve" })).toBeInTheDocument();
  });
});

describe("a list the chat puts in the content area", () => {
  it("is a table of the columns and rows it was given under the prompt", () => {
    const list = listAction("Which agents use the model?", "Agents", { columns: ["Agent", "Works for"], rows: [["Farmers' agent", "farmers"], ["Suppliers' agent", "suppliers"]] });
    render(<Host answer={list} />);

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Agent", "Works for"]);
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["Farmers' agentfarmers", "Suppliers' agentsuppliers"]);
    expect(screen.getByText("Which agents use the model?", { selector: "strong" })).toBeInTheDocument();
  });

  it("pads a short row and drops cells past the last column", () => {
    const list = listAction("Anything", "", { columns: ["A", "B"], rows: [["only"], ["x", "y", "extra"]] });
    render(<Host answer={list} />);

    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["only", "xy"]);
  });

  it("shows at most fifty rows", () => {
    const rows = Array.from({ length: 60 }, (_, index) => [`row ${index}`]);
    render(<Host answer={listAction("Anything", "", { columns: ["A"], rows })} />);

    expect(screen.getAllByRole("row")).toHaveLength(51);
  });

  it("shows at most eight columns, the first eight with the cells under them", () => {
    const columns = Array.from({ length: 9 }, (_, index) => `Column ${index + 1}`);
    const rows = [columns.map((_, index) => `cell ${index + 1}`)];
    render(<Host answer={listAction("Anything", "", { columns, rows })} />);

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(columns.slice(0, 8));
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([rows[0].slice(0, 8).join("")]);
  });

  it("keeps all the columns of a list that has exactly eight", () => {
    const columns = Array.from({ length: 8 }, (_, index) => `Column ${index + 1}`);
    render(<Host answer={listAction("Anything", "", { columns, rows: [columns.map((_, index) => `cell ${index + 1}`)] })} />);

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(columns);
  });

  it("says it could not load when it has no columns", () => {
    render(<Host answer={{ kind: "action", prompt: "Anything", view: "list", title: "", params: { columns: [], rows: [] } }} />);

    expect(screen.getByText("loadFailed")).toBeInTheDocument();
  });
});

describe("an action the console has no view for", () => {
  it("says it could not load instead of drawing nothing", () => {
    render(<Host answer={{ kind: "action", prompt: "Anything", view: "nothing-by-this-name", title: "", params: {} }} />);

    expect(screen.getByText("loadFailed")).toBeInTheDocument();
  });
});
