import { Navigate, useNavigate, useParams } from "react-router-dom";
import { mcpAgencyClient, type AgencyClient } from "../../features/agency/modules";
import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { Chip } from "../../shared/ui/Chip";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { Shell } from "../Shell";
import { routes } from "../routes";
import { named, sectionById } from "./sections";

export const notYetWords = "Not available yet";

export function SectionPage({ agency = mcpAgencyClient }: { agency?: AgencyClient }) {
  const { sectionId = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => agency.read(), `menu-modules:${openAgencyId()}`);
  const found = sectionById(sectionId);
  if (!found) return <Navigate to={agencyHomePath(openAgencyId())} replace />;
  const section = named(found, view.state === "ready" ? view.data : null);
  return (
    <Shell title={section.title} onBack={() => navigate(agencyHomePath(openAgencyId()))} backLabel="Home">
      <Rows>
        {section.items.map((item) => {
          const path = item.path;
          return path ? (
            <ListRow key={item.title} title={item.title} end="›" onClick={() => navigate(path(), { state: { from: { path: routes.menu.path({ sectionId }), title: section.title } } })} />
          ) : (
            <ListRow key={item.title} title={item.title} end={<Chip>{notYetWords}</Chip>} />
          );
        })}
      </Rows>
    </Shell>
  );
}
