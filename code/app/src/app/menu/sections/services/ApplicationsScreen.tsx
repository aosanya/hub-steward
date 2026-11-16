import { useNavigate } from "react-router-dom";
import { dayWords } from "../../../../shared/ui/days";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";
import { useWord } from "../../../../features/agency/useWord";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";
import { servicesPaths } from "./paths";

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

const newestFirst = (a: Item, b: Item) => text(b, "answered_at").localeCompare(text(a, "answered_at"));

const applicationRow = (sent: Item) => ({ id: text(sent, "form_id"), name: text(sent, "title"), line: `Sent ${dayWords(text(sent, "answered_at"))}` });

const loadApplications = async () => (await listOf("forms_form_list_answered")).sort(newestFirst).map(applicationRow);

export function ApplicationsScreen() {
  const back = useBackToSection();
  const navigate = useNavigate();
  const word = useWord("forms");
  const applicationsTitle = word("Applications");
  const open = (id: string) => navigate(servicesPaths.application.path({ id }), { state: { from: { path: servicesPaths.applications.path(), title: applicationsTitle } } });
  return (
    <Shell title={applicationsTitle} titleUnder tabless {...back}>
      <MenuList
        bare
        title={applicationsTitle}
        tool="forms_form_list_answered"
        load={loadApplications}
        fields={{ title: "name", meta: "line" }}
        empty={homeEmpty(`You have not sent ${withArticle(word("Application").toLowerCase())} yet.`)}
        onChoose={open}
      />
    </Shell>
  );
}
