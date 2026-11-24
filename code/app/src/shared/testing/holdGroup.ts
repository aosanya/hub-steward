import { rememberAssumedGroup } from "../wakala/assumedGroup";

export const holdGroupIn = (agencyId: string) => rememberAssumedGroup({ agencyId, id: "g1", name: "", count: 1 });
