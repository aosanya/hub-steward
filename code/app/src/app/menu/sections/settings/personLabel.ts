export const shortId = (id: string) => id.slice(0, 8);

export const nameOf = (person: Record<string, unknown>) => {
  const choices = [person.display_name, person.email, person.phone];
  return choices.find((choice): choice is string => typeof choice === "string" && choice.trim() !== "");
};

export const labelOf = (person: Record<string, unknown>) => nameOf(person) ?? shortId(String(person.id ?? ""));

export const unnamedPerson = "Unnamed person";

const looksLikeId = (value: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(value);

export const nameOrUnnamed = (person: Record<string, unknown>) => {
  const label = labelOf(person);
  return label === shortId(String(person.id ?? "")) ? unnamedPerson : label;
};

export const shownName = (value: string) => (value.trim() === "" || looksLikeId(value) ? unnamedPerson : value);
