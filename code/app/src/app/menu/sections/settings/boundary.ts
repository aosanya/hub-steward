export type Corner = [number, number];

const isCorner = (value: unknown): value is Corner => Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";

export const outerRingOf = (group: unknown): Corner[] => {
  const raw = typeof group === "object" && group !== null ? (group as { boundary?: unknown }).boundary : undefined;
  const { type, coordinates } = (typeof raw === "object" && raw !== null ? raw : {}) as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(coordinates)) return [];
  const first = type === "MultiPolygon" ? (Array.isArray(coordinates[0]) ? coordinates[0][0] : undefined) : coordinates[0];
  return Array.isArray(first) ? first.filter(isCorner).map(([lon, lat]): Corner => [lon, lat]) : [];
};

export const cornersFromText = (text: string): Corner[] | null => {
  const rows = text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[\s,;]+/).map(Number));
  const valid = rows.every(([lon, lat, ...rest]) => rest.length === 0 && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  const given = rows as Corner[];
  const closed = given.length > 1 && given[0][0] === given[given.length - 1][0] && given[0][1] === given[given.length - 1][1];
  const distinct = closed ? given.length - 1 : given.length;
  return valid && distinct >= 3 ? given.slice(0, distinct) : null;
};

export const textFromCorners = (ring: Corner[]): string => {
  const last = ring[ring.length - 1];
  const open = ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1] ? ring.slice(0, -1) : ring;
  return open.map(([lon, lat]) => `${lon}, ${lat}`).join("\n");
};

export const boundaryArgs = (groupId: string, corners: Corner[] | null) => ({
  group_id: groupId,
  ...(corners ? { boundary: { type: "Polygon", coordinates: [[...corners, corners[0]]] } } : {}),
});
