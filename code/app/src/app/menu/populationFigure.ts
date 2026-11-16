import { callTool } from "../../shared/wakala/mcp";

export const populationFigure = async (groupId: string): Promise<number | null> => {
  try {
    const reply = (await callTool("", "actor_get_group_population", { group_id: groupId })) as { population?: unknown } | null;
    return typeof reply?.population === "number" ? reply.population : null;
  } catch {
    return null;
  }
};
