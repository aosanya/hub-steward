import { callTool } from "../shared/wakala/mcp";

export type AgencyModule = { code: string; name: string; mountNames?: string[] };

export type AgencyView = { name: string; modules: AgencyModule[]; modulesUnread?: boolean };

export type AgencyClient = { read: () => Promise<AgencyView> };

export const agencyTools = { agency: "agency_get_agency", modules: "agency_list_mounts" };

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const moduleOf = (raw: any): AgencyModule => {
  const code = text(raw?.module);
  const mountNames: string[] = (Array.isArray(raw?.mounts) ? raw.mounts : []).map((mount: any) => text(mount?.name));
  return { code, name: mountNames[0] || code, mountNames };
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

export const taskModule = "taskmanager";

export const agencyInstanceAbsent = (reason: unknown) => reason instanceof Error && reason.message.includes("agencies: instance not found");

export const hasModule = (view: AgencyView | null | undefined, code: string) =>
  view !== null && view !== undefined && !view.modulesUnread && view.modules.some((module) => module.code === code);
