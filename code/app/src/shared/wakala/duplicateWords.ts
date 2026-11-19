type Labelled = { key: string; label: string };

const duplicateAttribute = /attribute value already in use: "([^"]+)"/;

const spaced = (name: string) => name.replace(/_/g, " ");

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const duplicateWords = (message: string, fields: Labelled[] = []) => {
  const name = duplicateAttribute.exec(message)?.[1];
  if (!name) return "";
  const label = fields.find((field) => field.key === name)?.label ?? capitalised(spaced(name));
  return `${label} already in use by another person.`;
};
