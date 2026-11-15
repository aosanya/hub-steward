export type HeldAgency = { id: string; name: string };

export const pickAgency = (agencies: HeldAgency[], name?: string): HeldAgency => {
  if (agencies.length === 0) throw new Error("signed in but belongs to no agency");
  if (name === undefined) return agencies[0];
  const found = agencies.find((agency) => agency.name === name);
  if (!found) throw new Error(`no agency named ${name}; held: ${agencies.map((agency) => agency.name).join(", ")}`);
  return found;
};
