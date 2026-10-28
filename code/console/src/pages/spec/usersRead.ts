import type { PageRow } from "../../types";

export const textOf = (value: unknown): string => (typeof value === "string" ? value : value === undefined || value === null ? "" : String(value));

export const listOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];

export type SeatRole = { group: string; role: string };

const seatRoles = (value: unknown): SeatRole[] =>
  listOf(value).map((seat) => ({ group: textOf(seat.group), role: textOf(seat.role) })).filter((seat) => seat.role);

export type UserLine = { id: string; code: string; name: string; groups: string[]; roles: SeatRole[]; joined: string };

export const userLine = (row: PageRow): UserLine => ({
  id: textOf(row.id),
  code: textOf(row.member_code),
  name: textOf(row.user) || textOf(row.member_code),
  groups: Array.isArray(row.groups) ? row.groups.map(textOf) : [],
  roles: seatRoles(row.roles),
  joined: textOf(row.joined),
});

export type GroupLine = { id: string; name: string; members: number; mode: string; aiRole: string };

export const groupLine = (row: PageRow): GroupLine => ({
  id: textOf(row.id),
  name: textOf(row.group),
  members: Number(row.members) || 0,
  mode: textOf(row.mode),
  aiRole: textOf(row.ai_role),
});

export type RoleLine = { id: string; name: string; description: string; ai: boolean };

export const roleLine = (row: Record<string, unknown>): RoleLine => ({
  id: textOf(row.id),
  name: textOf(row.name),
  description: textOf(row.description),
  ai: textOf(row.kind) === "ai",
});
