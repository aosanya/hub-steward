import { useConsole } from "../shell/context";
import { ModelsList } from "./models/ModelsList";
import "./models/models.css";

export function ModelsPage() {
  const { hub } = useConsole();
  return <ModelsList key={hub.id} />;
}
