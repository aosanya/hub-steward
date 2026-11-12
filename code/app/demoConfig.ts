import type { Plugin } from "vite";

export const demoConfigJson = (wakala: string | undefined, agency?: string) => {
  const only = (agency ?? "").trim();
  return JSON.stringify({ wakala: (wakala ?? "").trim().replace(/\/+$/, ""), ...(only ? { agency: only } : {}) });
};

export const demoConfig = (wakala: string | undefined, agency?: string): Plugin => ({
  name: "demo-config",
  configureServer(server) {
    if (!(wakala ?? "").trim() && !(agency ?? "").trim()) return;
    server.middlewares.use("/config.json", (_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(demoConfigJson(wakala, agency));
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "config.json", source: demoConfigJson(wakala, agency) });
  },
});
