export const measuresOn = false;

export const withoutMeasuresOff = (tools: string[]): string[] =>
  measuresOn ? tools : tools.filter((name) => !name.includes("measure"));
