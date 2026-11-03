import { createContext } from "react";

export const FailureCtx = createContext<(id: string, reason: string | null) => void>(() => {});

export const failureReason = (error: unknown): string | null => {
  if ((error as { unauthorized?: boolean } | null)?.unauthorized) return null;
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const plain = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return plain === "" ? null : plain;
};
