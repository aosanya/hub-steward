const separator = "-";

export const isTimeRange = (answerType: string) => answerType === "time_range";

export const splitRange = (text: string) => {
  const [from = "", to = ""] = text.split(separator);
  return { from, to };
};

export const joinRange = (from: string, to: string) => `${from}${separator}${to}`;

export const rangeWords = (from: string, to: string) => `from ${from} to ${to}`;
