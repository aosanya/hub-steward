import { currencyUnit } from "../forms/QuestionInput";
import type { ApprovalLimit } from "./api";

const spaced = (amount: number) => amount.toLocaleString("en-US").replace(/,/g, " ");

export function ApprovalLimitNote({ limit }: { limit?: ApprovalLimit }) {
  if (!limit) return null;
  return (
    <p className="meta">
      {limit.amount === undefined ? "No upper limit is written to your role." : `Your approval limit: ${spaced(limit.amount)} ${currencyUnit}`}
    </p>
  );
}
