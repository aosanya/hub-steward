import { callTool } from "../../wakala/mcp";

export type DeclineChoice = { silent: boolean; reason: string };

export const approveJoinRequest = async (hubId: string, requestId: string): Promise<void> => {
  await callTool(hubId, "actor_operator_approve_join_request", { request_id: requestId });
};

export const declineJoinRequest = async (hubId: string, requestId: string, choice: DeclineChoice): Promise<void> => {
  const reason = choice.reason.trim();
  const told = !choice.silent && reason !== "" ? { reason } : {};
  await callTool(hubId, "actor_operator_decline_join_request", { request_id: requestId, silent: choice.silent, ...told });
};
