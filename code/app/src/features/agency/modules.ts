import { callTool } from "../../shared/wakala/mcp";

export type AgencyModule = { code: string; name: string; mountNames?: string[]; words?: Record<string, string> };

export type AgencyView = { name: string; modules: AgencyModule[]; modulesUnread?: boolean };

export type AgencyClient = { read: () => Promise<AgencyView> };

export const agencyTools = { agency: "agency_get_agency", modules: "agency_list_mounts" };

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const wordsOf = (mounts: any[]): Record<string, string> => {
  const words: Record<string, string> = {};
  for (const mount of mounts) {
    const listed = mount?.words;
    if (listed === null || typeof listed !== "object" || Array.isArray(listed)) continue;
    for (const [generic, own] of Object.entries(listed)) {
      if (generic !== "" && text(own) !== "" && !Object.prototype.hasOwnProperty.call(words, generic)) words[generic] = text(own);
    }
  }
  return words;
};

export const moduleOf = (raw: any): AgencyModule => {
  const code = text(raw?.module);
  const mounts: any[] = Array.isArray(raw?.mounts) ? raw.mounts : [];
  const mountNames: string[] = mounts.map((mount: any) => text(mount?.name));
  const words = wordsOf(mounts);
  const module: AgencyModule = { code, name: mountNames[0] || code, mountNames };
  if (Object.keys(words).length > 0) module.words = words;
  return module;
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

const listedWord = (module: AgencyModule | undefined, generic: string) =>
  module?.words && Object.prototype.hasOwnProperty.call(module.words, generic) ? module.words[generic] : undefined;

export const word = (view: AgencyView | null | undefined, generic: string, section?: string): string => {
  if (!view || view.modulesUnread) return generic;
  const drawn = section === undefined ? undefined : listedWord(view.modules.find((module) => module.code === section), generic);
  if (drawn !== undefined) return drawn;
  for (const module of view.modules) {
    const own = listedWord(module, generic);
    if (own !== undefined) return own;
  }
  return generic;
};
