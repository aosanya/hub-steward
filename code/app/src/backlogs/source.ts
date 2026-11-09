const sourceStart = /^Read from\b/;

export const splitSource = (description: string) => {
  const lines = description.split("\n");
  const at = lines.findIndex((line) => sourceStart.test(line.trim()));
  return at === -1 ? { body: description.trim(), source: "" } : { body: lines.slice(0, at).join("\n").trim(), source: lines.slice(at).join("\n").trim() };
};
