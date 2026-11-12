import { McpError } from "../wakala/mcp";

const toolNotServed = /unknown tool/i;

export const isModuleOff = (error: unknown) => error instanceof McpError && !error.unauthorized && toolNotServed.test(error.message);

export const isOutage = (error: unknown) => !isModuleOff(error);
