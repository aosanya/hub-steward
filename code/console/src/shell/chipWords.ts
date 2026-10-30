import { createContext, useContext, useEffect } from "react";
import type { ChipWords } from "../data/menu";

export const ChipWordsCtx = createContext<(words: ChipWords) => void>(() => {});

export function useChipWords(step: string | undefined): void {
  const setWords = useContext(ChipWordsCtx);
  useEffect(() => {
    setWords(step ? { step } : {});
    return () => setWords({});
  }, [step, setWords]);
}
