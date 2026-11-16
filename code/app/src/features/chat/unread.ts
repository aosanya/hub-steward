export const unreadCap = 99;

export const unreadLabel = (count: number | null | undefined): string => {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return "";
  return count > unreadCap ? `${unreadCap}+` : String(Math.floor(count));
};
