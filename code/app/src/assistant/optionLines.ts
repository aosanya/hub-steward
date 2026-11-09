const option = /^\s*\[\[(.+?)\]\]\s*$/;

export const splitOptions = (text: string) => {
  const lines = text.split("\n");
  const options = lines.flatMap((line) => option.exec(line)?.[1].trim() ?? []);
  const rest = lines.filter((line) => !option.test(line)).join("\n").trim();
  return { text: rest, options };
};
