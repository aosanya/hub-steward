import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTools, type ToolInfo } from "../wakala/mcp";
import { ToolMissing, drawnSchema, toolSchema } from "./actionSchema";

vi.mock("../wakala/mcp", () => ({ listTools: vi.fn() }));

const listToolsMock = vi.mocked(listTools);

const createGoal: ToolInfo = {
  name: "agency_create_goal",
  description: "Create goal",
  inputSchema: {
    type: "object",
    properties: {
      instance_id: { type: "string" },
      draft_id: { type: "string" },
      title: { type: "string", description: "The goal in one line." },
      description: { type: "string" },
    },
    required: ["draft_id", "instance_id", "title"],
  },
};

beforeEach(() => {
  listToolsMock.mockReset();
});

describe("drawing a form from a tool's input schema", () => {
  it("keeps only the properties the form shows, in the order the form lists them", () => {
    const schema = drawnSchema(createGoal.inputSchema, { tool: "agency_create_goal", show: ["description", "title"] });

    expect(Object.keys((schema as { properties: object }).properties)).toEqual(["description", "title"]);
  });

  it("keeps the schema's own description of a property", () => {
    const schema = drawnSchema(createGoal.inputSchema, { tool: "agency_create_goal", show: ["title"] });

    expect((schema as { properties: Record<string, object> }).properties.title).toEqual({
      type: "string",
      description: "The goal in one line.",
    });
  });

  it("requires only the shown properties the schema requires", () => {
    const schema = drawnSchema(createGoal.inputSchema, { tool: "agency_create_goal", show: ["title", "description", "draft_id"] });

    expect((schema as { required: string[] }).required).toEqual(["title", "draft_id"]);
  });

  it("lays the form's shape over a property and adds one the tool does not have", () => {
    const schema = drawnSchema(createGoal.inputSchema, {
      tool: "agency_create_goal",
      show: ["title", "description", "name"],
      shape: { description: { format: "textarea" }, name: { type: "string" } },
    });

    expect((schema as { properties: Record<string, object> }).properties).toMatchObject({
      description: { type: "string", format: "textarea" },
      name: { type: "string" },
    });
  });

  it("leaves out a shown name the tool does not have and the form gives no shape for", () => {
    const schema = drawnSchema(createGoal.inputSchema, { tool: "agency_create_goal", show: ["title", "purpose"] });

    expect(Object.keys((schema as { properties: object }).properties)).toEqual(["title"]);
  });

  it("draws nothing from a schema that is not an object", () => {
    const schema = drawnSchema("nope", { tool: "x", show: ["title"] });

    expect(schema).toEqual({ type: "object", properties: {}, required: [] });
  });
});

describe("reading the schema of the tool a form sends", () => {
  it("finds the tool among the hub's tools", async () => {
    listToolsMock.mockResolvedValue([{ name: "other", description: "", inputSchema: {} }, createGoal]);

    const schema = await toolSchema({ tool: "agency_create_goal", show: ["title"] });

    expect((schema as { required: string[] }).required).toEqual(["title"]);
  });

  it("says so when the hub offers no such tool", async () => {
    listToolsMock.mockResolvedValue([createGoal]);

    await expect(toolSchema({ tool: "sources_document_create", show: ["title"] })).rejects.toBeInstanceOf(ToolMissing);
  });

  it("passes on a failure to list the tools", async () => {
    listToolsMock.mockRejectedValue(new Error("offline"));

    await expect(toolSchema({ tool: "agency_create_goal", show: ["title"] })).rejects.toThrow("offline");
  });
});
