import { Chip } from "../../../../shared/ui/Chip";
import type { LicenceMark } from "./licensedRows";

const toneOf = (mark: LicenceMark) => (mark === "Licensed" ? "success" : mark === "Expired" ? "danger" : undefined);

export function LicenceChip({ mark }: { mark: LicenceMark }) {
  return <Chip tone={toneOf(mark)}>{mark}</Chip>;
}
