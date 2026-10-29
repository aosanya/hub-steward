import { useNavigate } from "react-router-dom";
import { Segmented } from "../../ui/Segmented";

export type BuyerView = "prices" | "asks";

const views: { id: BuyerView; label: string; path: string }[] = [
  { id: "prices", label: "Your prices", path: "/prices" },
  { id: "asks", label: "Asks", path: "/sell/asks" },
];

export function BuyerTabs({ active }: { active: BuyerView }) {
  const navigate = useNavigate();
  return <Segmented items={views} current={active} onChange={(id) => navigate(views.find((view) => view.id === id)?.path ?? "/")} />;
}
