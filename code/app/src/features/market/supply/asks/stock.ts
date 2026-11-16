export type StockLine = { listed: number; promised: number; unit: string };

export type AskText = { question: string; detail: string };

export type StockReader = (ask: AskText) => Promise<StockLine | null>;

export const noStock: StockReader = async () => null;

export const stockText = (line: StockLine) =>
  `Your list: ${line.listed} ${line.unit}. Already promised: ${line.promised} ${line.unit}`;
