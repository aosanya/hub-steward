import { useNavigate } from "react-router-dom";
import { useMay } from "../../features/agency/useMay";
import { Button } from "../../shared/ui/Button";

type ActProps = { label: string; to: string };

type Props = ActProps & { permission: string };

export function AddAct({ label, to }: ActProps) {
  const navigate = useNavigate();
  return <Button kind="primary" onClick={() => navigate(to)}>{label}</Button>;
}

export function AddButton({ permission, label, to }: Props) {
  const may = useMay(permission);
  if (!may) return null;
  return <AddAct label={label} to={to} />;
}
