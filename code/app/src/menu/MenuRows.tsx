import { useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { routes } from "../routes";
import { Icon } from "../ui/Icon";
import { ListRow, Rows } from "../ui/ListRow";
import { sectionsFor } from "./sections";

export function MenuRows({ agency = mcpAgencyClient }: { agency?: AgencyClient }) {
  const navigate = useNavigate();
  const view = useLoad(() => agency.read(), `menu-modules:${openAgencyId()}`);
  const sections = view.state === "ready" ? sectionsFor(view.data) : [];
  if (sections.length === 0) return null;
  return (
    <Rows>
      {sections.map((section) => (
        <ListRow
          key={section.id}
          title={section.title}
          start={<span className="mark" aria-hidden="true"><Icon name={section.icon} /></span>}
          end="›"
          onClick={() => navigate(routes.menu.path({ sectionId: section.id }))}
        />
      ))}
    </Rows>
  );
}
