import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyClient } from "../../features/agency/modules";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { routes } from "../routes";
import { Icon } from "../../shared/ui/Icon";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { sectionsFor } from "./sections";

export function MenuRows({ agency = mcpAgencyClient, between }: { agency?: AgencyClient; between?: ReactNode }) {
  const navigate = useNavigate();
  const view = useLoad(() => agency.read(), `menu-modules:${openAgencyId()}`);
  const sections = view.state === "ready" ? sectionsFor(view.data) : [];
  if (sections.length === 0) return between ? <Rows>{between}</Rows> : null;
  const last = sections.at(-1);
  const closing = last?.id === "settings" ? last : undefined;
  const row = (section: (typeof sections)[number]) => (
    <ListRow
      key={section.id}
      title={section.title}
      start={<span className="mark" aria-hidden="true"><Icon name={section.icon} /></span>}
      end="›"
      onClick={() => navigate(routes.menu.path({ sectionId: section.id }))}
    />
  );
  return (
    <Rows>
      {sections.filter((section) => section !== closing).map(row)}
      {between}
      {closing ? row(closing) : null}
    </Rows>
  );
}
