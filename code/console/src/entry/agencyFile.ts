export type AgencyFile = { document: Record<string, unknown>; name: string; roles: number; goals: number; workflows: number };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const sizeOf = (value: unknown) => (Array.isArray(value) ? value.length : -1);

export function readAgency(text: string): AgencyFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !isObject(parsed.agency)) return null;
  const roles = sizeOf(parsed.roles);
  const goals = sizeOf(parsed.goals);
  const workflows = sizeOf(parsed.workflows);
  if (roles < 0 || goals < 0 || workflows < 0) return null;
  const name = typeof parsed.agency.name === "string" ? parsed.agency.name.trim() : "";
  return { document: parsed, name, roles, goals, workflows };
}
