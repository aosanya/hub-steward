export const shortId = (id: string) => id.slice(0, 8);

export const labelOf = (person: Record<string, unknown>) => {
  const choices = [person.display_name, person.email, person.phone];
  const found = choices.find((choice): choice is string => typeof choice === "string" && choice.trim() !== "");
  return found ?? shortId(String(person.id ?? ""));
};
