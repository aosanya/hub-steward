import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { carryChatAbout, forgetChatAbout, useChatAboutOpen } from "../../app/chatAbout";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { askAssistant, offeredNames, systemPrompt } from "./api";
import { pageLines, readsOnlyRule, residentReadsOnlyRule, withResidentRule } from "./triager";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../../shared/wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const resident = { kind: "resident" as const, id: "p1", name: "Takács Erzsébet" };

const residentReads = [
  { name: "accounting_bill_list", scope: "actor_id" },
  { name: "digitaltwin_tenure_list", scope: "holder_actor_id" },
  { name: "forms_submission_list_of_person", scope: "member_id" },
  { name: "forms_catalog_raised_item_list_of_person", scope: "raised_by" },
];

const toolInfo = (name: string, properties: Record<string, unknown>) => ({ name, description: name, inputSchema: { type: "object", properties, required: [] } });

const hubTools = [
  ...offeredNames.map((name) => toolInfo(name, {})),
  ...residentReads.map(({ name, scope }) => toolInfo(name, { [scope]: { type: "string" }, status: { type: "string" }, instance_id: { type: "string" } })),
];

const openResident = () => {
  const hook = renderHook(() => useChatAboutOpen(resident));
  carryChatAbout();
  hook.unmount();
};

let modelTurns: Record<string, unknown>[] = [];

beforeEach(() => {
  openAgency("zoldhalom");
  forgetChatAbout();
  modelTurns = [{ message: { content: "done" } }];
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(hubTools);
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "ai_chat_account") return modelTurns.shift() ?? { message: { content: "done" } };
    if (name === "taskmanager_backlog_list") return { items: [] };
    return { items: [{ id: "x1" }] };
  });
});

afterEach(() => {
  forgetChatAbout();
  forgetOpenAgency();
});

const ask = () => askAssistant("acc1", [{ role: "user", content: "what does Takács Erzsébet owe?" }]);

const offeredToTheModel = () => {
  const chat = mcp.callTool.mock.calls.find(([, name]) => name === "ai_chat_account");
  const tools = (chat?.[2] as { tools?: { name: string; parameters: { properties: Record<string, unknown> } }[] }).tools ?? [];
  return tools;
};

const readsMade = (name: string) => mcp.callTool.mock.calls.filter(([, called]) => called === name).map(([, , args]) => args);

describe("with a resident open the assistant is offered the four reads about that resident", () => {
  it("offers bills, holdings, applications and raised items", async () => {
    openResident();
    await ask();
    const names = offeredToTheModel().map((tool) => tool.name);
    for (const { name } of residentReads) expect(names).toContain(name);
  });

  it("does not let the model pick the person: the scope field is not in the tool's schema", async () => {
    openResident();
    await ask();
    const offered = offeredToTheModel();
    for (const { name, scope } of residentReads) {
      const tool = offered.find((one) => one.name === name);
      expect(tool?.parameters.properties).not.toHaveProperty(scope);
      expect(tool?.parameters.properties).not.toHaveProperty("instance_id");
    }
  });

  it("names the resident in the system lines and says the four lists can be read", async () => {
    openResident();
    await ask();
    const chat = mcp.callTool.mock.calls.find(([, name]) => name === "ai_chat_account");
    const sent = JSON.stringify((chat?.[2] as { messages: unknown }).messages);
    expect(sent).toContain(resident.id);
    expect(sent).toMatch(/bills, holdings, applications/i);
  });

  it.each(residentReads)("calls $name with the open resident whatever id the model passes", async ({ name, scope }) => {
    openResident();
    modelTurns = [{ message: { content: "", tool_calls: [{ id: "c1", name, arguments: { [scope]: "someone-else", status: "open" } }] } }, { message: { content: "done" } }];
    await ask();
    expect(readsMade(name)).toEqual([{ [scope]: resident.id, status: "open" }]);
  });
});

describe("with no resident open the assistant gets none of the four reads", () => {
  it("offers none of them", async () => {
    await ask();
    const names = offeredToTheModel().map((tool) => tool.name);
    for (const { name } of residentReads) expect(names).not.toContain(name);
  });

  it.each(residentReads)("refuses a call to $name and reads nothing", async ({ name, scope }) => {
    modelTurns = [{ message: { content: "", tool_calls: [{ id: "c1", name, arguments: { [scope]: "p1" } }] } }, { message: { content: "done" } }];
    await ask();
    expect(readsMade(name)).toEqual([]);
  });

  it("adds no line about a resident", async () => {
    await ask();
    const chat = mcp.callTool.mock.calls.find(([, name]) => name === "ai_chat_account");
    expect(JSON.stringify((chat?.[2] as { messages: unknown }).messages)).not.toMatch(/bills, holdings, applications/i);
  });
});

describe("a caller without resident.read", () => {
  it("has no resident carried, so is offered none of the four reads", async () => {
    forgetChatAbout();
    await ask();
    const names = offeredToTheModel().map((tool) => tool.name);
    for (const { name } of residentReads) expect(names).not.toContain(name);
  });
});

describe("a hub that does not list a read", () => {
  it("is not offered it, whatever is open", async () => {
    mcp.listTools.mockResolvedValue(hubTools.filter((tool) => tool.name !== "accounting_bill_list"));
    openResident();
    await ask();
    expect(offeredToTheModel().map((tool) => tool.name)).not.toContain("accounting_bill_list");
  });
});

const systemText = () => {
  const chat = mcp.callTool.mock.calls.find(([, name]) => name === "ai_chat_account");
  const messages = (chat?.[2] as { messages: { role: string; content: string }[] }).messages;
  return messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
};

const saysBillsCannotBeRead = /cannot read (bills|holdings|applications|raised)|For bills, payments, residents/i;

describe("the rule about what the assistant can read agrees with the tools it is given", () => {
  it("says no sentence that bills cannot be read when a resident is open", async () => {
    openResident();
    await ask();
    expect(systemText()).not.toMatch(saysBillsCannotBeRead);
    expect(systemText()).not.toContain(readsOnlyRule);
    expect(systemText()).toContain(residentReadsOnlyRule);
  });

  it("still says it when no resident is open", async () => {
    await ask();
    expect(systemText()).toContain(readsOnlyRule);
    expect(systemText()).toMatch(/cannot read bills/i);
    expect(systemText()).not.toContain(residentReadsOnlyRule);
  });

  it("swaps the rule in the hub's own prompt lines and in the fallback prompt", () => {
    for (const prompt of [pageLines, systemPrompt]) {
      const swapped = withResidentRule(prompt);
      expect(swapped).toContain(residentReadsOnlyRule);
      expect(swapped).not.toContain(readsOnlyRule);
      expect(swapped).not.toMatch(saysBillsCannotBeRead);
    }
  });

  it("still forbids an answer of none for anything it cannot read", () => {
    expect(residentReadsOnlyRule).toMatch(/never say there are none/i);
    expect(residentReadsOnlyRule).toMatch(/failed/i);
  });
});
