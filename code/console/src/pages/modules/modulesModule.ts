import { loadModules } from "../../data/pages/agencyModules";
import type { PageModule } from "../../data/types";

export const modulesPage: PageModule = {
  spec: {
    id: "modules",
    title: "Modules",
    primary: "",
    tools: ["agency_list_modules", "agency_set_module_enabled"],
    columns: [
      { key: "name", label: "Module" },
      { key: "description", label: "Description" },
    ],
  },
  rows: async (hubId) =>
    (await loadModules(hubId)).map((module) => ({ id: module.id, name: module.name, description: module.description })),
};
