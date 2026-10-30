import { callTool } from "../../wakala/mcp";
import type { GoalPlan } from "../chatFill";
import { workingDraft } from "./workflowDesign";

type Item = Record<string, unknown>;

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const idOf = (made: unknown): string => {
  const item = isRecord(made) && isRecord(made.goal) ? made.goal : made;
  return isRecord(item) && typeof item.id === "string" ? item.id : "";
};

export type Created = { goals: string[]; objectives: number; failed: string[] };

export async function createGoals(hubId: string, plans: GoalPlan[]): Promise<Created> {
  if (plans.length === 0) throw new Error("no goal was given");
  const draftId = await workingDraft(hubId);
  const created: Created = { goals: [], objectives: 0, failed: [] };
  for (const plan of plans) {
    try {
      const goalId = idOf(await callTool<unknown>(hubId, "agency_create_goal", { draft_id: draftId, title: plan.title, description: plan.description }));
      if (!goalId) throw new Error("the goal was not given an id");
      created.goals.push(plan.title);
      for (const objective of plan.objectives) {
        try {
          await callTool(hubId, "agency_create_objective", { draft_id: draftId, goal_id: goalId, title: objective.title, description: objective.description });
          created.objectives++;
        } catch {
          created.failed.push(objective.title);
        }
      }
    } catch {
      created.failed.push(plan.title);
    }
  }
  if (created.goals.length === 0) throw new Error("no goal could be created");
  return created;
}
