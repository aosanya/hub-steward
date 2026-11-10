import { askAssistant, systemPrompt } from "./api";
import { pageLines, promptFrom, publicationsTool, rolesTool, triagerDescription } from "./triager";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const description =
  "The backlog's AI role. If asked to load the boards it says the loader is run in a terminal on the owner's laptop. For what is pending it first calls taskmanager_task_pending.";

const publications = {
  items: [
    { channel: "production", version: 1, draft_id: "old" },
    { channel: "production", version: 2, draft_id: "live" },
    { channel: "staging", version: 3, draft_id: "staged" },
  ],
};

const roles = { items: [{ name: "Product owner", description: "the owner" }, { name: "Triager", description }] };

const hub = (found: { publications?: unknown; roles?: unknown }) =>
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === publicationsTool) return found.publications ?? { items: [] };
    if (name === rolesTool) return found.roles ?? { items: [] };
    return { message: { content: "ok" } };
  });

const systemSent = () => {
  const chat = mcp.callTool.mock.calls.find((call) => call[1] === "ai_chat_account")!;
  return chat[2].messages[0] as { role: string; content: string };
};

beforeEach(() => {
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue([]);
});

describe("the Triager's description reaches the model", () => {
  it("sends the description of the Triager role of the newest production publication, then the page's own lines", async () => {
    hub({ publications, roles });
    await askAssistant("acc1", [{ role: "user", content: "Load the boards" }]);
    expect(mcp.callTool).toHaveBeenCalledWith("", rolesTool, { draft_id: "live" });
    const system = systemSent();
    expect(system.role).toBe("system");
    expect(system.content).toContain(description);
    expect(system.content.endsWith(pageLines)).toBe(true);
  });

  it("carries the loading rule and the pending-first rule from the description, which the page's own prompt lacked", async () => {
    hub({ publications, roles });
    await askAssistant("acc1", [{ role: "user", content: "hi" }]);
    const content = systemSent().content;
    expect(content).toContain("the loader is run in a terminal on the owner's laptop");
    expect(content).toContain("it first calls taskmanager_task_pending");
    expect(systemPrompt).not.toContain("loader is run in a terminal");
  });

  it("falls back to the page's own prompt when the hub has no production publication", async () => {
    hub({ publications: { items: [{ channel: "staging", version: 1, draft_id: "staged" }] }, roles });
    await askAssistant("acc1", [{ role: "user", content: "hi" }]);
    expect(systemSent().content).toBe(systemPrompt);
  });

  it("falls back when the role list has no Triager", async () => {
    hub({ publications, roles: { items: [{ name: "Product owner", description: "the owner" }] } });
    await askAssistant("acc1", [{ role: "user", content: "hi" }]);
    expect(systemSent().content).toBe(systemPrompt);
  });

  it("falls back when the person may not read the publications", async () => {
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
      if (name === publicationsTool) throw new Error("refused");
      return { message: { content: "ok" } };
    });
    await askAssistant("acc1", [{ role: "user", content: "hi" }]);
    expect(systemSent().content).toBe(systemPrompt);
  });

  it("answers an empty description with an empty string and builds the prompt from the fallback", async () => {
    hub({ publications, roles: { items: [{ name: "Triager", description: "  " }] } });
    expect(await triagerDescription()).toBe("");
    expect(promptFrom("", "fallback")).toBe("fallback");
  });

  it("tells the model to look an issue up and move it by its id, in the page lines and the fallback prompt", () => {
    for (const lines of [pageLines, systemPrompt]) {
      expect(lines).toContain("first look it up with taskmanager_task_pending");
      expect(lines).toContain("move it by the id you read, never by its key");
    }
  });
});
