const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function formatWhen(iso: string, lang: string, now: Date = new Date()): string {
  const moment = new Date(iso);
  if (iso === "" || Number.isNaN(moment.getTime())) return iso;
  const time = moment.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay(moment, now)) return time;
  return `${moment.toLocaleDateString(lang, { month: "short", day: "numeric" })}, ${time}`;
}
