import { useNavigate, useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { useConsole } from "../../shell/context";
import { addStartOfQuery } from "./addStartLink";
import { ModelAdd } from "./ModelAdd";
import "./models.css";

export function ModelAddPage() {
  const { hub } = useConsole();
  const [query] = useSearchParams();
  const navigate = useNavigate();

  return <ModelAdd key={`${hub.id}?${query}`} start={addStartOfQuery(query)} onBack={() => navigate(hubPath(hub.id, "models"))} />;
}
