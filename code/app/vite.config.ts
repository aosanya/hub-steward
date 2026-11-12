import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { demoConfig } from "./demoConfig";

const proxyTarget = process.env.HUBSTEWARD_PROXY_TO;
const forward = proxyTarget
  ? {
      target: proxyTarget,
      changeOrigin: true,
      configure: (proxy: { on: (event: string, handler: (request: { removeHeader: (name: string) => void }) => void) => void }) => {
        proxy.on("proxyReq", (request) => {
          request.removeHeader("origin");
          request.removeHeader("referer");
        });
      },
    }
  : undefined;

export default defineConfig({
  plugins: [react(), demoConfig(process.env.HUBSTEWARD_WAKALA_URL, process.env.HUBSTEWARD_ONLY_AGENCY)],
  server: forward
    ? { proxy: Object.fromEntries(["auth", "me", "instances", "services", "mcp", "platform", "launch", "owner", "languages", "directory"].map((path) => [`/${path}`, forward])) }
    : undefined,
  base: "/",
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], css: false },
});
