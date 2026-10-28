export const pageLabel = (t: (key: string) => string, page: string): string => {
  const key = "menu." + page;
  const label = t(key);
  return label === key ? page : label;
};

export const withStep = (text: string, step: string | undefined): string =>
  text.replace("{step}", step ?? "");

export const withPage = (text: string, label: string): string =>
  text.replace("{page}", label);

const itemParameters: Record<string, string> = {
  objectives: "objective",
  goals: "goal",
};

export const itemPageOf = (page: string, search: string): string => {
  const parameter = itemParameters[page];
  return parameter && new URLSearchParams(search).get(parameter)
    ? parameter
    : page;
};
