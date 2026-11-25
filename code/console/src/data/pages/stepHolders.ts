export type HoldingAction = "add" | "edit" | "delete";

export type HoldingField = { code: string; required: boolean };

export type HoldingRole = { name: string; permissions: string[] };

const star = "*";

const codeOf = (recordCode: string, action: HoldingAction, field = ""): string => {
  const code = `record.${recordCode}.${action}`;
  return action === "delete" || field === "" ? code : `${code}.${field}`;
};

const holdsAdd = (carries: (field: string) => boolean, fields: HoldingField[]): boolean => {
  if (carries(star)) return true;
  const required = fields.filter((field) => field.required);
  if (required.length === 0) return fields.some((field) => field.code !== "" && carries(field.code));
  return required.every((field) => field.code !== "" && carries(field.code));
};

export const roleHoldsStep = (recordCode: string, fields: HoldingField[], action: HoldingAction, granted: string[]): boolean => {
  const carries = (field: string) => granted.includes(codeOf(recordCode, action, field));
  switch (action) {
    case "delete":
      return granted.includes(codeOf(recordCode, "delete"));
    case "edit":
      return carries(star) || fields.some((field) => field.code !== "" && carries(field.code));
    case "add":
      return holdsAdd(carries, fields);
  }
};

export const holdersOf = (recordCode: string, fields: HoldingField[], action: HoldingAction, roles: HoldingRole[]): string[] =>
  roles.filter((role) => roleHoldsStep(recordCode, fields, action, role.permissions)).map((role) => role.name);

export const holderNames = (names: string[]): string => names.join(", ");
