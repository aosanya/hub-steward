export const kes = (amount: number | string) => {
  const value = typeof amount === "number" ? amount : amount.trim() === "" ? NaN : Number(amount);
  return Number.isFinite(value) ? `KES ${value.toLocaleString("en-US")}` : `${amount}`;
};
