const marker = /\[\[(.+?)\]\]/g;

const optionsOf = (line: string) => {
  const found = [...line.matchAll(marker)].map((match) => match[1].trim());
  return found.length > 0 && line.replace(marker, "").trim() === "" ? found : null;
};

export const splitOptions = (text: string) => {
  const lines = text.split("\n");
  const options = lines.flatMap((line) => optionsOf(line) ?? []);
  const rest = lines.filter((line) => optionsOf(line) === null).join("\n").trim();
  return { text: rest, options };
};
