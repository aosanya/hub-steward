import { vi } from "vitest";
import type { AssumedGroupsClient, MyGroupsReading, SeatedGroup } from "./assumedApi";

export const emea: SeatedGroup = { id: "g1", name: "EMEA", roles: ["Practice Director", "Reviewer"] };
export const americas: SeatedGroup = { id: "g2", name: "Americas", roles: ["Reviewer"] };
export const audit: SeatedGroup = { id: "g3", name: "Audit", roles: [] };

export const reading = (groups: SeatedGroup[], assumedId = ""): MyGroupsReading => ({ groups, assumedId });

export const fakeClient = (first: MyGroupsReading, over: Partial<AssumedGroupsClient> = {}) => {
  const client = {
    read: vi.fn(async () => first),
    assume: vi.fn(async () => undefined),
    ...over,
  };
  return client satisfies AssumedGroupsClient;
};
