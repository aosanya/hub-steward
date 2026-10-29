import { spawnSync } from "node:child_process";

if (!process.env.HUBSTEWARD_WAKALA_URL) {
  console.error("HUBSTEWARD_WAKALA_URL is not set; the owner supplies the wakala-api address at build time");
  process.exit(1);
}

const run = spawnSync("npm", ["run", "build"], { stdio: "inherit", env: process.env });
process.exit(run.status ?? 1);
