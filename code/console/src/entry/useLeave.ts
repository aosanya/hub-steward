import { useNavigate } from "react-router-dom";
import { useSession } from "../session";

export function useLeave() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  return () => {
    signOut()
      .catch(() => {})
      .finally(() => navigate("/start"));
  };
}
