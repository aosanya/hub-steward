import { callTool } from "../../wakala/mcp";
import { rest } from "../../wakala/rest";
import type { WaitingToJoin } from "./users";

type Level = WaitingToJoin["level"];

export type DeclineChoice = { silent: boolean; reason: string };

const decideAtAgency = async (hubId: string, userId: string, verdict: "approve" | "refuse"): Promise<void> => {
  const reply = await rest("POST", `/instances/${hubId}/join-requests/${userId}/${verdict}`);
  if (!reply.ok) throw new Error(`agency join request not ${verdict}d`);
};

export const approveJoinRequest = async (hubId: string, requestId: string, level: Level = "group"): Promise<void> => {
  if (level === "agency") return decideAtAgency(hubId, requestId, "approve");
  await callTool(hubId, "actor_operator_approve_join_request", { request_id: requestId });
};

export const declineJoinRequest = async (hubId: string, requestId: string, choice: DeclineChoice, level: Level = "group"): Promise<void> => {
  if (level === "agency") return decideAtAgency(hubId, requestId, "refuse");
  const reason = choice.reason.trim();
  const told = !choice.silent && reason !== "" ? { reason } : {};
  await callTool(hubId, "actor_operator_decline_join_request", { request_id: requestId, silent: choice.silent, ...told });
};
