import { listTools } from "../wakala/mcp";

export type ToolDrawing = {
  tool: string;
  show: string[];
  shape?: Record<string, Record<string, unknown>>;
};

export class ToolMissing extends Error {}

type Shape = Record<string, unknown>;

const isShape = (value: unknown): value is Shape => typeof value === "object" && value !== null && !Array.isArray(value);

const requiredOf = (schema: Shape): string[] =>
  Array.isArray(schema.required) ? schema.required.filter((name): name is string => typeof name === "string") : [];

export function drawnSchema(inputSchema: unknown, drawing: ToolDrawing): object {
  const schema = isShape(inputSchema) ? inputSchema : {};
  const properties = isShape(schema.properties) ? schema.properties : {};
  const required = new Set(requiredOf(schema));
  const shape = drawing.shape ?? {};
  const kept = drawing.show.filter((name) => Object.hasOwn(properties, name) || Object.hasOwn(shape, name));
  return {
    type: "object",
    properties: Object.fromEntries(
      kept.map((name) => {
        const own = isShape(properties[name]) ? properties[name] : {};
        return [name, { ...own, ...(shape[name] ?? {}) }];
      }),
    ),
    required: kept.filter((name) => required.has(name)),
  };
}

export async function toolSchema(drawing: ToolDrawing): Promise<object> {
  const found = (await listTools()).find((info) => info.name === drawing.tool);
  if (!found) throw new ToolMissing(`${drawing.tool} is not offered by this hub's tools`);
  return drawnSchema(found.inputSchema, drawing);
}
