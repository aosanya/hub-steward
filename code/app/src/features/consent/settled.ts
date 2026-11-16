const settled = new Set<string>();

export const isSettled = (agencyId: string) => settled.has(agencyId);

export const settle = (agencyId: string) => void settled.add(agencyId);

export const unsettle = (agencyId: string) => void settled.delete(agencyId);
