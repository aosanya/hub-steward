import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { addOriginOf, stepPathOf, type AddItem } from "./homeWorkflows";

export function HomeAddRows({ items }: { items: AddItem[] }) {
  const navigate = useNavigate();
  const { code } = useLanguage();
  return (
    <Rows>
      {items.map((item) => (
        <ListRow key={item.id} title={item.name} end="›" onClick={() => navigate(stepPathOf(item.step), { state: addOriginOf(item, code) })} />
      ))}
    </Rows>
  );
}
