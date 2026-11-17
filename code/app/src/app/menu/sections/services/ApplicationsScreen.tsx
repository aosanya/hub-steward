import { dayWords } from "../../../../shared/ui/days";
import { MenuWindow } from "../../MenuWindow";
import { useWord } from "../../../../features/agency/useWord";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";
import { useApplicationDetail } from "./ApplicationScreen";
import { decisionStatus } from "./decision";

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

const newestFirst = (a: Item, b: Item) => text(b, "answered_at").localeCompare(text(a, "answered_at"));

const statusLine = (sent: Item) => {
  const status = decisionStatus(text(sent, "decision"));
  return status === "" ? `Sent ${dayWords(text(sent, "answered_at"))}` : `${status} ${dayWords(text(sent, "decided_at"))}`;
};

const applicationRow = (sent: Item) => ({ id: text(sent, "form_id"), name: text(sent, "title"), line: statusLine(sent) });

const loadApplications = async () => (await listOf("forms_form_list_answered")).sort(newestFirst).map(applicationRow);

export function ApplicationsScreen() {
  const word = useWord("forms");
  const applicationsTitle = word("Applications");
  const { detail, version } = useApplicationDetail();
  return (
    <MenuWindow
      title={applicationsTitle}
      detailKey={version}
      list={{
        title: applicationsTitle,
        tool: "forms_form_list_answered",
        load: loadApplications,
        fields: { title: "name", meta: "line" },
        empty: homeEmpty(`You have not sent ${withArticle(word("Application").toLowerCase())} yet.`),
      }}
      detail={detail}
    />
  );
}
