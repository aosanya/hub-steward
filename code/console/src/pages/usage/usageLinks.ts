const carried = ["span", "group", "role"];

export const usagePages = ["usage", "usage-overview", "usage-work", "usage-agents"];

export const usageSearch = (pathname: string, search: string): string => {
  const page = pathname.split("/")[3] ?? "";
  if (!usagePages.includes(page)) return "";
  const from = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of carried) {
    const value = from.get(key);
    if (value) kept.set(key, value);
  }
  const text = kept.toString();
  return text ? "?" + text : "";
};
