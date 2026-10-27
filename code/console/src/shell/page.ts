export type Badges = Record<string, number>;

export const noBadges: Badges = {};

export function sameBadges(a: Badges, b: Badges): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

const decoded = (segment: string | undefined): string => {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export function pageOf(pathname: string): string {
  return decoded(pathname.split("/")[3]) || "status";
}
