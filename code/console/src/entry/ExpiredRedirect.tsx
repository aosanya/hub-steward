import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../session";

export function ExpiredRedirect() {
  const { expired } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (expired) navigate("/login", { replace: true });
  }, [expired, navigate]);

  return null;
}
