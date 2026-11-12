import { sharedRead } from "../../inbox/sharedRead";
import { mcpStartClient, type StartClient, type StartStep } from "./api";

type Reader = Pick<StartClient, "waiting">;

export type WaitingStatus = "loading" | "ready" | "failed";

const useWaitingRead = sharedRead<Reader, StartStep[]>((client) => client.waiting());

export const useStartWaitingRead = (client: Reader = mcpStartClient) => useWaitingRead(client);

export function useStartWaiting(client: Reader = mcpStartClient): StartStep[] | null {
  const { value, failed } = useWaitingRead(client);
  return failed ? [] : value;
}

export function useStartWaitingState(client: Reader = mcpStartClient) {
  const { value, failed, refresh } = useWaitingRead(client);
  const status: WaitingStatus = failed ? "failed" : value === null ? "loading" : "ready";
  return { steps: value ?? [], status, retry: refresh };
}
