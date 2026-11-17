import { currencyUnit } from "../forms/QuestionInput";
import type { ApprovalLimit } from "./api";
import { spacedAmount } from "./spacedAmount";

export function ApprovalLimitNote({ limit }: { limit?: ApprovalLimit }) {
  if (!limit) return null;
  return (
    <p className="meta">
      {limit.amount === undefined ? "No upper limit is written to your role." : `Your approval limit: ${spacedAmount(limit.amount)} ${currencyUnit}`}
    </p>
  );
}
