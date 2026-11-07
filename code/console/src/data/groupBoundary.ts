import { callTool } from "../wakala/mcp";

export type Corner = [number, number];

export type Boundary = { type: "Polygon" | "MultiPolygon"; rings: Corner[][] };

const isCorner = (value: unknown): value is Corner =>
  Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";

const ringOf = (value: unknown): Corner[] => (Array.isArray(value) ? value.filter(isCorner).map(([lon, lat]): Corner => [lon, lat]) : []);

export const boundaryOf = (group: unknown): Boundary | null => {
  const raw = typeof group === "object" && group !== null ? (group as { boundary?: unknown }).boundary : undefined;
  if (typeof raw !== "object" || raw === null) return null;
  const { type, coordinates } = raw as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(coordinates)) return null;
  if (type === "Polygon") return { type, rings: coordinates.map(ringOf).filter((ring) => ring.length > 0) };
  if (type === "MultiPolygon") {
    const rings = coordinates.flatMap((polygon) => (Array.isArray(polygon) ? polygon.map(ringOf) : [])).filter((ring) => ring.length > 0);
    return { type, rings };
  }
  return null;
};

export const loadBoundary = async (hubId: string, groupId: string): Promise<Boundary | null> =>
  boundaryOf(await callTool(hubId, "actor_get_group", { group_id: groupId }));

export const cornersFromText = (text: string): Corner[] | null => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const corners = lines.map((line) => line.split(/[\s,;]+/).map(Number));
  const valid = corners.every(
    ([lon, lat, ...rest]) => rest.length === 0 && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90,
  );
  const given = corners as Corner[];
  const closed = given.length > 1 && given[0][0] === given[given.length - 1][0] && given[0][1] === given[given.length - 1][1];
  const distinct = closed ? given.length - 1 : given.length;
  return valid && distinct >= 3 ? given.slice(0, distinct) : null;
};

export const textFromCorners = (ring: Corner[]): string => {
  const last = ring[ring.length - 1];
  const open = ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1] ? ring.slice(0, -1) : ring;
  return open.map(([lon, lat]) => `${lon}, ${lat}`).join("\n");
};

export const saveBoundary = (hubId: string, groupId: string, corners: Corner[] | null): Promise<unknown> =>
  callTool(hubId, "actor_set_group_boundary", {
    group_id: groupId,
    ...(corners ? { boundary: { type: "Polygon", coordinates: [[...corners, corners[0]]] } } : {}),
  });
