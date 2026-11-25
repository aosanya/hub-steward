import { backlogTools } from "../manage/api";
import { callTool } from "../../../shared/wakala/mcp";
import { failureOf } from "./answers";
import type { RulebookClient } from "./types";

export const readRulesPermission = "rule.read";

export const mayReadRulesIn = (reply: any) => Array.isArray(reply?.permissions) && reply.permissions.includes(readRulesPermission);

export const askMayReadRules = async (): Promise<boolean> => mayReadRulesIn(await callTool("", backlogTools.myRoles));

export const guardedRulebook = (client: RulebookClient, ask: () => Promise<boolean> = askMayReadRules): RulebookClient => {
  const guard =
    <Args extends unknown[], T>(call: (...args: Args) => Promise<T>) =>
    async (...args: Args): Promise<T | { state: "no_access" } | ReturnType<typeof failureOf>> => {
      try {
        if (!(await ask())) return { state: "no_access" };
      } catch (error) {
        return failureOf(error);
      }
      return call(...args);
    };
  return {
    list: guard(client.list) as RulebookClient["list"],
    read: guard(client.read) as RulebookClient["read"],
    issues: guard(client.issues) as RulebookClient["issues"],
    files: guard(client.files) as RulebookClient["files"],
    produced: guard(client.produced) as RulebookClient["produced"],
    settledIn: guard(client.settledIn) as RulebookClient["settledIn"],
    why: guard(client.why) as RulebookClient["why"],
    open: guard(client.open) as RulebookClient["open"],
  };
};
