import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hubPath } from "../api";
import { useSession } from "../session";
import type { Hub } from "../types";
import { Loading } from "../ui";

export const landingPath = (hubs: Hub[]) => (hubs.length > 0 ? hubPath(hubs[0].id, "status") : "/create");

export function Gate() {
  const { restore, signedIn, hubs } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    let waiting = true;
    restore().then(
      (restored) => {
        if (waiting && !restored) navigate("/start", { replace: true });
      },
      () => {
        if (waiting) navigate("/start", { replace: true });
      },
    );
    return () => {
      waiting = false;
    };
  }, [restore, navigate]);

  useEffect(() => {
    if (signedIn) navigate(landingPath(hubs), { replace: true });
  }, [signedIn, hubs, navigate]);

  return <Loading />;
}
