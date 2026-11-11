import { createContext, useContext, type ReactNode } from "react";
import type { Issue } from "../api";
import type { CapsClient } from "./api";
import type { CapTint } from "./capTint";
import { useCapTints, type CapTints } from "./useCapTints";

const CapTintsContext = createContext<CapTints>({});

type Props = { issues: Issue[]; client?: CapsClient; children: ReactNode };

export function CapTintScope({ issues, client, children }: Props) {
  return <CapTintsContext.Provider value={useCapTints(issues, client)}>{children}</CapTintsContext.Provider>;
}

export const useCapTintOf = (issueId: string): CapTint | null => useContext(CapTintsContext)[issueId] ?? null;
