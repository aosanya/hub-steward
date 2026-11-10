import { callTool } from "../wakala/mcp";
import { hubBacklogOf, itemsOf, taskTools } from "../backlogs/api";
import { refusalText } from "../backlogManage/api";
import type { SendClient, SendResult, Target } from "./types";

export const sendTools = { move: "taskmanager_task_move_to_step" };

const mayMoveIn = (raw: any) => raw?.level === undefined || raw.level === "move";

export const targetsOf = (reply: any): Target[] =>
  itemsOf(reply)
    .filter(mayMoveIn)
    .map(hubBacklogOf)
    .filter((backlog) => backlog.id !== "" && backlog.steps.length > 0)
    .map((backlog) => ({ backlogId: backlog.id, name: backlog.name, stepId: backlog.steps[0].id, stepName: backlog.steps[0].name }));

const refusalOf = (error: unknown) => refusalText(error) || "The move was refused.";

export const mcpSendClient: SendClient = {
  async targets() {
    return targetsOf(await callTool("", taskTools.backlogs, {}));
  },
  async send(issueIds, target): Promise<SendResult> {
    let sent = 0;
    for (const taskID of issueIds) {
      try {
        await callTool("", sendTools.move, { taskID, backlog: target.backlogId, step: target.stepId });
      } catch (error) {
        return { sent, refusal: refusalOf(error) };
      }
      sent += 1;
    }
    return { sent, refusal: "" };
  },
};
