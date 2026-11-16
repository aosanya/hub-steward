import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const noticeOf = (state: unknown): string | undefined => {
  const asked = (state as { notice?: unknown } | null | undefined)?.notice;
  return typeof asked === "string" && asked !== "" ? asked : undefined;
};

export function useOnceNotice(): string | undefined {
  const navigate = useNavigate();
  const { pathname, search, state } = useLocation();
  const [notice] = useState(() => noticeOf(state));
  const arrivedWithOne = noticeOf(state) !== undefined;
  useEffect(() => {
    if (arrivedWithOne) navigate({ pathname, search }, { replace: true, state: null });
  }, [arrivedWithOne, navigate, pathname, search]);
  return notice;
}
