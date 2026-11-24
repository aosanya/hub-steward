import { createContext } from "react";
import type { MyGroup } from "../data/groups";

export type GroupControl = {
  groups: MyGroup[];
  assumed: MyGroup;
  assume: (group: MyGroup) => Promise<boolean>;
};

export const GroupCtx = createContext<GroupControl | null>(null);
