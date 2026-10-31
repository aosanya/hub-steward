import type { Finding } from "./reviewApi";

export const isActionable = (finding: Finding): boolean => finding.fate !== "fixed" && finding.fate !== "withdrawn";
