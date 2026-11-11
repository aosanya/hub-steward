import { Chip } from "../../ui/Chip";
import type { CapTint } from "./capTint";
import "./caps.css";

export function CapTintChip({ found }: { found: CapTint | null }) {
  return found ? <Chip tone={found.danger ? "danger" : undefined}>{found.chip}</Chip> : null;
}
