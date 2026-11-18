import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadRoleKinds, roleNamesOf } from "../../roleKinds";

export type Item = Record<string, unknown>;

export const text = (item: Item | null | undefined, key: string) => {
  const value = item?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const listOf = async (tool: string, args?: Record<string, unknown>) => itemsOf(await callTool("", tool, args)) as Item[];

export const homeEmpty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

export const peopleWords = (count: number) => `${count} ${count === 1 ? "person" : "people"}`;

export const roleKindNames = async () => roleNamesOf(await loadRoleKinds());

export const seatLabel = (seat: Item, kindNames: Map<string, string>) => {
  const role = text(seat, "role_name") || kindNames.get(text(seat, "kind_id")) || "";
  const department = text(seat, "group_name");
  return role && department ? `${role} · ${department}` : role;
};

export const seatsLine = (seats: Item[], kindNames: Map<string, string>) =>
  seats
    .filter((seat) => seat.active !== false && text(seat, "ended_at") === "")
    .map((seat) => seatLabel(seat, kindNames))
    .filter((label) => label !== "")
    .join(", ");
