import { sharedRead } from "../../inbox/sharedRead";
import { mcpStartClient, type StartClient, type StartStep } from "./api";

type Reader = Pick<StartClient, "waiting">;

const useWaitingRead = sharedRead<Reader, StartStep[]>((client) => client.waiting());

export const useStartWaitingRead = (client: Reader = mcpStartClient) => useWaitingRead(client);

export function useStartWaiting(client: Reader = mcpStartClient): StartStep[] | null {
  const { value, failed } = useWaitingRead(client);
  return failed ? [] : value;
}
