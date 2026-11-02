import { beforeEach, expect, test, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { approveJoinRequest, declineJoinRequest } from "./joinDecisions";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

beforeEach(() => {
  call.mockReset();
  call.mockResolvedValue({});
});

test("approving decides the request as the operator, straight away and without a proposal", async () => {
  await approveJoinRequest("h1", "r1");
  expect(call.mock.calls).toEqual([["h1", "actor_operator_approve_join_request", { request_id: "r1" }]]);
});

test("declining with a reason tells the person the reason, trimmed", async () => {
  await declineJoinRequest("h1", "r1", { silent: false, reason: "  Not a farmer.  " });
  expect(call.mock.calls).toEqual([["h1", "actor_operator_decline_join_request", { request_id: "r1", silent: false, reason: "Not a farmer." }]]);
});

test("declining without a reason sends no reason", async () => {
  await declineJoinRequest("h1", "r1", { silent: false, reason: "   " });
  expect(call.mock.calls).toEqual([["h1", "actor_operator_decline_join_request", { request_id: "r1", silent: false }]]);
});

test("declining quietly sends no reason even when one was typed", async () => {
  await declineJoinRequest("h1", "r1", { silent: true, reason: "Not a farmer." });
  expect(call.mock.calls).toEqual([["h1", "actor_operator_decline_join_request", { request_id: "r1", silent: true }]]);
});

test("a refused decision is thrown to the caller", async () => {
  call.mockRejectedValue(new Error("refused"));
  await expect(approveJoinRequest("h1", "r1")).rejects.toThrow("refused");
  await expect(declineJoinRequest("h1", "r1", { silent: true, reason: "" })).rejects.toThrow("refused");
});
