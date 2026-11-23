import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { Icon } from "../../shared/ui/Icon";
import { ListRow } from "../../shared/ui/ListRow";
import { titleIn } from "./homeDeclaration";
import { useHomeFacts, type HomeWiring } from "./homeFacts";
import { homeSectionPath } from "./homePaths";
import { toolsKey, toolsOf } from "./homeLayout";
import { shownNodes } from "./homeVisibility";

export function useToolsShown(wiring: HomeWiring) {
  const facts = useHomeFacts([toolsOf()], wiring, 0);
  return facts.state === "ready" && shownNodes([toolsOf()], facts.data).length > 0;
}

export function ToolsRow() {
  const navigate = useNavigate();
  const { code } = useLanguage();
  return <ListRow title={titleIn(toolsOf(), code)} start={<span className="mark" aria-hidden="true"><Icon name="tools" /></span>} end="›" onClick={() => navigate(homeSectionPath(toolsKey))} />;
}
