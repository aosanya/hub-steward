import type { Plugin } from "vite";

export const demoConfigJson = (wakala: string | undefined) =>
  JSON.stringify({ wakala: (wakala ?? "").trim().replace(/\/+$/, "") });

export const demoConfig = (wakala: string | undefined): Plugin => ({
  name: "demo-config",
  configureServer(server) {
    if (!(wakala ?? "").trim()) return;
    server.middlewares.use("/config.json", (_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(demoConfigJson(wakala));
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "config.json", source: demoConfigJson(wakala) });
  },
});
