export function reportWhen(iso: string, lang: string): string {
  const moment = new Date(iso);
  if (iso === "" || Number.isNaN(moment.getTime())) return iso;
  return moment.toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
}
