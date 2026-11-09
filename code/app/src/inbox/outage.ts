import { McpError } from "../wakala/mcp";

const serverFailure = /^wakala answered 5/;

export const isOutage = (error: unknown) => !(error instanceof McpError) || error.unauthorized || serverFailure.test(error.message);
