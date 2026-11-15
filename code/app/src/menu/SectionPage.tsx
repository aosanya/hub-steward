import { Navigate, useNavigate, useParams } from "react-router-dom";
import { agencyHomePath, openAgencyId } from "../agency/open";
import { Chip } from "../ui/Chip";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { sectionById } from "./sections";

export const notYetWords = "Not available yet";

export function SectionPage() {
  const { sectionId = "" } = useParams();
  const navigate = useNavigate();
  const section = sectionById(sectionId);
  if (!section) return <Navigate to={agencyHomePath(openAgencyId())} replace />;
  return (
    <Shell title={section.title}>
      <Rows>
        {section.items.map((item) => {
          const path = item.path;
          return path ? (
            <ListRow key={item.title} title={item.title} end="›" onClick={() => navigate(path())} />
          ) : (
            <ListRow key={item.title} title={item.title} end={<Chip>{notYetWords}</Chip>} />
          );
        })}
      </Rows>
    </Shell>
  );
}
