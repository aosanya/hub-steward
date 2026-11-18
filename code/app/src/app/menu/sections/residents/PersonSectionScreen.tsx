import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { PersonApplications } from "./PersonLinks";
import { PersonBills } from "./PersonBills";
import { PersonHoldings } from "./PersonHoldings";
import { PersonRaised } from "./PersonRaised";
import { PersonGroups, loadPerson } from "./PersonScreen";
import { residentPaths } from "./paths";
import { personSectionKeys, type PersonSectionKey } from "./personSections";
import { useWord } from "../../../../features/agency/useWord";

const sections = {
  groups: { Component: PersonGroups, module: "actor", word: "Groups" },
  applications: { Component: PersonApplications, module: "forms", word: "Applications" },
  wishes: { Component: PersonRaised, module: "forms", word: "Wishes and issues" },
  bills: { Component: PersonBills, module: "accounting", word: "Bills" },
  holdings: { Component: PersonHoldings, module: "digitaltwin", word: "Holdings" },
};

export function PersonSectionScreen() {
  const { id = "", section = "" } = useParams();
  const navigate = useNavigate();
  const known = (personSectionKeys as readonly string[]).includes(section);
  const chosen = sections[(known ? section : "groups") as PersonSectionKey];
  const word = useWord(chosen.module)(chosen.word);
  const view = useLoad(() => loadPerson(id), `person-section:${openAgencyId()}:${id}`);
  const name = view.state === "ready" ? String(view.data.display_name ?? "") : "";
  const back = () => navigate(residentPaths.people.path({ person: id }));
  return (
    <Shell title={word} titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">
          <chosen.Component id={id} full />
        </div>
      ) : null}
    </Shell>
  );
}
