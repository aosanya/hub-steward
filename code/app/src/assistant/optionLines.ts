const marker = /\[\[(.+?)\]\]/g;

const danglingQuestion = /(\bwhich\b[^.?!\n]*?)\s*[—–-]\s*$/i;

const closeQuestion = (text: string) => text.replace(danglingQuestion, "$1?");

const optionsOf = (line: string) => {
  const found = [...line.matchAll(marker)].map((match) => match[1].trim());
  return found.length > 0 && line.replace(marker, "").trim() === "" ? found : null;
};

export const splitOptions = (text: string) => {
  const lines = text.split("\n");
  const options = lines.flatMap((line) => optionsOf(line) ?? []);
  const rest = lines.filter((line) => optionsOf(line) === null).join("\n").trim();
  return { text: options.length > 0 ? closeQuestion(rest) : rest, options };
};
