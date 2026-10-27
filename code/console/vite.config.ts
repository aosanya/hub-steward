import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

const wakala = process.env.WAKALA_URL ?? "http://localhost:8082";

const sameOriginConfig: Plugin = {
  name: "same-origin-config",
  configureServer(server) {
    server.middlewares.use("/config.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ wakala: "", mcp: "/mcp", template: "siaya-lab" }));
    });
  },
};

const forward = (target: string) => ({
  target,
  changeOrigin: true,
  configure: (proxy: any) => {
    proxy.on("proxyReq", (request: any) => {
      request.removeHeader("origin");
      request.removeHeader("referer");
    });
  },
});

export default defineConfig({
  plugins: [react(), sameOriginConfig],
  base: "/",
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    proxy: {
      "/auth": forward(wakala),
      "/instances": forward(wakala),
      "/services": forward(wakala),
      "/mcp": forward(wakala),
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], css: false, exclude: ["node_modules/**", "e2e/**"] },
});
