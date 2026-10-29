import { callTool } from "../wakala/mcp";

export type AgencyModule = { code: string; name: string };

export type AgencyView = { name: string; modules: AgencyModule[]; modulesUnread?: boolean };

export type AgencyClient = { read: () => Promise<AgencyView> };

export const agencyTools = { agency: "agency_get_agency", modules: "agency_list_mounts" };

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const moduleOf = (raw: any): AgencyModule => {
  const code = text(raw?.module);
  return { code, name: text(raw?.mounts?.[0]?.name) || code };
};

export const modulesOf = (reply: any): AgencyModule[] =>
  (Array.isArray(reply?.modules) ? reply.modules : []).filter((raw: any) => text(raw?.module) !== "").map(moduleOf);

export const mcpAgencyClient: AgencyClient = {
  async read() {
    const [agency, modules] = await Promise.allSettled([
      callTool("", agencyTools.agency, {}),
      callTool("", agencyTools.modules, {}),
    ]);
    if (agency.status === "rejected" && modules.status === "rejected") throw modules.reason;
    const name = agency.status === "fulfilled" ? text(agency.value?.name) : "";
    if (modules.status === "fulfilled" && Array.isArray(modules.value?.modules)) return { name, modules: modulesOf(modules.value) };
    return { name, modules: [], modulesUnread: true };
  },
};
