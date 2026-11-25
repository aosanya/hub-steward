import { allIssuesId } from "../shared/api";
import { guardedRulebook, mcpRulebookClient, type Answer, type Rule, type RuleFile, type RulebookClient } from "../rulebook";
import { inBook } from "./bookRules";

export type CameFrom = { id: string; code: string };

export type Refs = { cameFrom: CameFrom[]; files: RuleFile[] };

export type BookClient = {
  rules(): Promise<Answer<Rule[]>>;
  refs(code: string): Promise<Refs>;
};

const ofReady = <T,>(answer: Answer<T[]>): T[] => (answer.state === "ready" ? answer.data : []);

export const mcpBookClient = (client: RulebookClient = guardedRulebook(mcpRulebookClient())): BookClient => ({
  rules: async () => {
    const answer = await client.list(allIssuesId, "rule", { statuses: ["in_force"] });
    return answer.state === "ready" ? { state: "ready", data: inBook(answer.data) } : answer;
  },
  refs: async (code) => {
    const [issues, files] = await Promise.all([client.issues(code), client.files(code)]);
    return {
      cameFrom: ofReady(issues)
        .filter((issue) => issue.relation === "decided_in")
        .map(({ id, code: issueCode }) => ({ id, code: issueCode })),
      files: ofReady(files),
    };
  },
});
