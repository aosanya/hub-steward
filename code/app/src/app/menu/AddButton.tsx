import { useNavigate } from "react-router-dom";
import { useMay } from "../../features/agency/useMay";
import { Button } from "../../shared/ui/Button";

type Props = { permission: string; label: string; to: string };

export function AddButton({ permission, label, to }: Props) {
  const may = useMay(permission);
  const navigate = useNavigate();
  if (!may) return null;
  return <Button kind="primary" onClick={() => navigate(to)}>{label}</Button>;
}
