import { McpError } from "../../shared/wakala/mcp";
import schemas from "./liveSchemas.json";

type Declared = { properties: string[]; required: string[] };

const declared = schemas as Record<string, Declared>;

const alwaysSent = "instance_id";

export const refuseUndeclared = (tool: string, given: Record<string, unknown>) => {
  const schema = declared[tool];
  if (!schema) return;
  const sent = Object.keys(given);
  const stranger = sent.find((key) => !schema.properties.includes(key));
  if (stranger) throw new McpError(`${tool} takes no argument "${stranger}"`);
  const absent = schema.required.find((key) => key !== alwaysSent && !(key in given));
  if (absent) throw new McpError(`${tool} needs ${absent}`);
};
