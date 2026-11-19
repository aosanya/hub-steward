type Item = Record<string, unknown>;

const words = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string).trim() : "");

export const namedPersonOf = (person: Item) => {
  const shown = words(person, "display_name");
  if (shown !== "") return shown;
  return [words(person, "first_name"), words(person, "last_name")].filter(Boolean).join(" ");
};

export const personNameOf = (person: Item) => namedPersonOf(person) || words(person, "code");
