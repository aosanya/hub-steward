import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onRefused } from "../wakala/mcp";
import { checkSession, endSession, hadSession } from "../wakala/me";

const onSignIn = (pathname: string) => pathname === "/sign-in" || pathname.startsWith("/sign-in/");

export function SessionGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const here = useRef(pathname);
  here.current = pathname;

  useEffect(() => {
    let alive = true;
    const verify = async () => {
      if (onSignIn(here.current)) return;
      if ((await checkSession()) !== "out" || !alive || onSignIn(here.current)) return;
      const ended = hadSession();
      endSession();
      navigate(ended ? "/sign-in?ended" : "/sign-in", { replace: true });
    };
    verify();
    const stop = onRefused(verify);
    return () => {
      alive = false;
      stop();
    };
  }, [navigate]);

  return <>{children}</>;
}
