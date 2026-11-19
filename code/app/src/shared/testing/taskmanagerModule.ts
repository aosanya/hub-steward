import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const taskmanagerModule = "github.com/aosanya/mwanachama-backend-taskmanager";

const moduleDirectory = (): string =>
  execFileSync("go", ["list", "-m", "-f", "{{.Dir}}", taskmanagerModule], {
    cwd: resolve(process.cwd(), "../wakala-api"),
    encoding: "utf8",
  }).trim();

export const taskmanagerModuleFile = (relativePath: string): string => readFileSync(join(moduleDirectory(), relativePath), "utf8");
