import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { demoConfig } from "./demoConfig";

export default defineConfig({
  plugins: [react(), demoConfig(process.env.HUBSTEWARD_WAKALA_URL)],
  base: "/",
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], css: false },
});
