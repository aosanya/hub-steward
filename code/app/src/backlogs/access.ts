import { backlogTools } from "../backlogManage/api";
import { callTool } from "../wakala/mcp";

export const readPermission = "task.read";

export const noRoleWords = "You do not have access to the Backlogs yet. Ask the Product owner.";

export const nothingSharedWords = "No backlogs shared with you yet";

export const mayReadIn = (reply: any) => (Array.isArray(reply?.permissions) ? reply.permissions.includes(readPermission) : true);

export const askMayRead = async (): Promise<boolean> => mayReadIn(await callTool("", backlogTools.myRoles));
