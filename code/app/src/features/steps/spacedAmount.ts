export const spacedAmount = (amount: number) => amount.toLocaleString("en-US").replace(/,/g, " ");

export const spacedAmountWithUnit = (amount: number, unit: string) => [spacedAmount(amount), unit].filter((part) => part !== "").join(" ");
