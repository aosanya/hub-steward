export const shortId = (id: string) => id.slice(0, 8);

export const labelOf = (person: Record<string, unknown>) => {
  const choices = [person.display_name, person.email, person.phone];
  const found = choices.find((choice): choice is string => typeof choice === "string" && choice.trim() !== "");
  return found ?? shortId(String(person.id ?? ""));
};

export const unnamedPerson = "Unnamed person";

const looksLikeId = (value: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(value);

export const nameOrUnnamed = (person: Record<string, unknown>) => {
  const label = labelOf(person);
  return label === shortId(String(person.id ?? "")) ? unnamedPerson : label;
};

export const shownName = (value: string) => (looksLikeId(value) ? unnamedPerson : value);
