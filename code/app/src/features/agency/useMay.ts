import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../forms/useLoad";

const rolesTool = "agency_get_my_roles";

const holds = async (permission: string) => {
  const reply = (await callTool("", rolesTool)) as { permissions?: unknown } | null;
  return Array.isArray(reply?.permissions) && reply.permissions.includes(permission);
};

export function useMay(permission: string) {
  const answer = useLoad(() => holds(permission), `may:${openAgencyId()}:${permission}`);
  return answer.state === "ready" && answer.data;
}
