import type { Plugin } from "vite";

export const demoConfigJson = (wakala: string | undefined) =>
  JSON.stringify({ wakala: (wakala ?? "").trim().replace(/\/+$/, "") });

export const demoConfig = (wakala: string | undefined): Plugin => ({
  name: "demo-config",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "config.json", source: demoConfigJson(wakala) });
  },
});
