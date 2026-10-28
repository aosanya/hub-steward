import { createContext, useContext, useEffect } from "react";

export const LoadingCtx = createContext<(change: number) => void>(() => {});

export function useReportLoading(loading: boolean) {
  const report = useContext(LoadingCtx);
  useEffect(() => {
    if (!loading) return;
    report(1);
    return () => report(-1);
  }, [loading, report]);
}
