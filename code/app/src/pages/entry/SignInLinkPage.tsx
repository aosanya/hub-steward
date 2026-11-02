import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resetMcp } from "../../wakala/mcp";
import { checkSession, forgetSubject } from "../../wakala/me";
import { forgetToken, keepToken, readLinkFragment } from "../../wakala/token";

export const linkFailedPath = "/sign-in?link=failed";

export function SignInLinkPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [token] = useState(() => readLinkFragment(hash));

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    if (token === null) {
      navigate(linkFailedPath, { replace: true });
      return;
    }
    let alive = true;
    keepToken(token);
    forgetSubject();
    resetMcp();
    checkSession().then((state) => {
      if (!alive) return;
      if (state === "out") {
        forgetToken();
        navigate(linkFailedPath, { replace: true });
        return;
      }
      navigate("/", { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, token]);

  return null;
}
