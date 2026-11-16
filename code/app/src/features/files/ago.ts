const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const counted = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;

export const agoWords = (when: string, now: number = Date.now()) => {
  const from = Date.parse(when);
  if (Number.isNaN(from)) return "";
  const elapsed = Math.max(now - from, 0);
  if (elapsed >= day) return counted(Math.floor(elapsed / day), "day");
  if (elapsed >= hour) return counted(Math.floor(elapsed / hour), "hour");
  return counted(Math.max(Math.floor(elapsed / minute), 1), "minute");
};
