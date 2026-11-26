import { useCurrencyUnit } from "../agency/currencyUnit";
import type { ApprovalLimit } from "./api";
import { spacedAmountWithUnit } from "./spacedAmount";

export function ApprovalLimitNote({ limit }: { limit?: ApprovalLimit }) {
  const currencyUnit = useCurrencyUnit();
  if (!limit) return null;
  return (
    <p className="meta">
      {limit.amount === undefined ? "No upper limit is written to your role." : `Your approval limit: ${spacedAmountWithUnit(limit.amount, currencyUnit)}`}
    </p>
  );
}
