export type Often = "weekly" | "fortnightly" | "monthly";

export type ScheduleParts = { often: Often; weekday: string; monthday: string };

const dayNames: Record<string, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };

export const weekdayChoices = Object.entries(dayNames).map(([value, label]) => ({ value, label }));

export const oftenChoices = [
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
];

const partOf = (rule: string, name: string) => new RegExp(`(?:^|;)${name}=([^;]+)`).exec(rule)?.[1] ?? "";

export const partsOf = (rule: string): ScheduleParts | null => {
  const frequency = partOf(rule, "FREQ");
  const interval = Number(partOf(rule, "INTERVAL") || 1);
  const weekday = partOf(rule, "BYDAY");
  const monthday = partOf(rule, "BYMONTHDAY");
  if (frequency === "WEEKLY" && interval === 1 && dayNames[weekday]) return { often: "weekly", weekday, monthday: "" };
  if (frequency === "WEEKLY" && interval === 2 && dayNames[weekday]) return { often: "fortnightly", weekday, monthday: "" };
  if (frequency === "MONTHLY" && interval === 1 && /^\d{1,2}$/.test(monthday)) return { often: "monthly", weekday: "", monthday };
  return null;
};

export const ruleOf = ({ often, weekday, monthday }: ScheduleParts) =>
  often === "monthly" ? `FREQ=MONTHLY;BYMONTHDAY=${monthday}` : `FREQ=WEEKLY;${often === "fortnightly" ? "INTERVAL=2;" : ""}BYDAY=${weekday}`;

const ordinalOf = (day: number) => {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${{ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th"}`;
};

export const ruleWords = (rule: string) => {
  const parts = partsOf(rule);
  if (!parts) return rule;
  if (parts.often === "monthly") return `Every month on the ${ordinalOf(Number(parts.monthday))}`;
  return `${parts.often === "weekly" ? "Every week" : "Every 2 weeks"} on ${dayNames[parts.weekday]}`;
};
