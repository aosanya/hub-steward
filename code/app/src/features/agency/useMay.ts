import { useEffect } from "react";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../forms/useLoad";
import { reportMayFailed, useMayVersion } from "./mayStore";

const rolesTool = "agency_get_my_roles";

const readPermissions = async () => ((await callTool("", rolesTool)) as { permissions?: unknown } | null)?.permissions;

const holds = async (permission: string) => {
  const permissions = await readPermissions().catch(readPermissions);
  return Array.isArray(permissions) && permissions.includes(permission);
};

export function useMayAnswer(permission: string) {
  const version = useMayVersion();
  const answer = useLoad(() => holds(permission), `may:${openAgencyId()}:${permission}:${version}`);
  const failed = answer.state === "error";
  useEffect(() => {
    if (failed) reportMayFailed();
  }, [failed]);
  return { known: answer.state !== "loading", may: answer.state === "ready" && answer.data, failed };
}

export const useMay = (permission: string) => useMayAnswer(permission).may;
