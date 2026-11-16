import { useState, type ComponentProps } from "react";
import { dayWords } from "../../../../shared/ui/days";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { MenuWindow } from "../../MenuWindow";
import { useBackToSection } from "../../useBackToSection";
import { useWord } from "../../../../features/agency/useWord";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";

const paidWords = "Paid";

const markPaidLabel = "Mark paid";

function ServicesList(props: Omit<ComponentProps<typeof MenuList>, "bare">) {
  const back = useBackToSection();
  return (
    <Shell title={props.title} titleUnder tabless {...back}>
      <MenuList {...props} bare />
    </Shell>
  );
}

const sentWords = "Sent";

const withdrawnWords = "Withdrawn";

const notSentWords = "Not sent yet";

const submissionsTool = "forms_catalog_entry_submissions_mine";

const listTool = "forms_catalog_entry_list_public";

const listFields = { title: "name", meta: "line" };

const detailFields = { "Sent on": "sent" };

const isPaid = (submission: Item) => submission.paid === true;

const isWithdrawn = (submission: Item) => text(submission, "withdrawn_at") !== "";

const isOwing = (submission: Item) => !isPaid(submission) && !isWithdrawn(submission);

const byNewest = (a: Item, b: Item) => text(b, "submitted_at").localeCompare(text(a, "submitted_at"));

const statusOf = (submission: Item) => {
  if (isWithdrawn(submission)) return withdrawnWords;
  return isPaid(submission) ? paidWords : sentWords;
};

const entryRow = (entry: Item) => ({ id: text(entry, "slug"), name: text(entry, "name"), line: text(entry, "summary") });

const loadKind = (kind: string) => async () => (await listOf(listTool, { kind })).map(entryRow);

const loadSubmissions = async (slug: string) => {
  const sent = (await listOf(submissionsTool, { slug })).sort(byNewest);
  return {
    id: slug,
    status: sent.length === 0 ? notSentWords : statusOf(sent[0]),
    sent: sent.map((submission) => dayWords(text(submission, "submitted_at"))).join(", "),
    owing: sent.filter(isOwing),
  };
};

const markPaid = (submission: Item) =>
  callTool("", "forms_submission_mark_paid", { form_id: text(submission, "form_id"), member_id: text(submission, "member_id"), paid: true });

const KindScreen = ({ generic, emptyGeneric, kind, payable }: { generic: string; emptyGeneric: string; kind: string; payable?: boolean }) => {
  const word = useWord("forms");
  const title = word(generic);
  const empty = `No ${word(emptyGeneric).toLowerCase()} yet.`;
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const owing = (item: Item) => (item.owing as Item[] | undefined) ?? [];
  const pay = (item: Item) => {
    setFailed(false);
    Promise.all(owing(item).map(markPaid)).then(
      () => setVersion((current) => current + 1),
      () => setFailed(true),
    );
  };
  const action = payable
    ? { label: markPaidLabel, tool: "forms_submission_mark_paid", run: pay, when: (item: Item) => owing(item).length > 0 }
    : undefined;
  return (
    <MenuWindow
      title={title}
      detailKey={version}
      list={{ title, tool: listTool, fields: listFields, empty: homeEmpty(empty), load: loadKind(kind) }}
      detail={{ tool: submissionsTool, fields: detailFields, status: "status", load: loadSubmissions, action }}
      below={failed ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
};

export const PermitsScreen = () => <KindScreen generic="Permits" emptyGeneric="Permits" kind="permit" />;

export const LicencesScreen = () => <KindScreen generic="Licences" emptyGeneric="Licences" kind="licence" />;

export const FeesPaymentsScreen = () => <KindScreen generic="Fees & Payments" emptyGeneric="Fees" kind="fee" payable />;

const catalogueRow = (entry: Item) => ({ id: text(entry, "id"), name: text(entry, "name"), line: text(entry, "summary") });

export function ServiceCatalogueScreen() {
  const word = useWord("forms");
  const load = async () => (await listOf("forms_catalog_entry_list_public")).map(catalogueRow);
  return (
    <ServicesList
      title={word("Service Catalogue")}
      tool="forms_catalog_entry_list_public"
      load={load}
      fields={{ title: "name", meta: "line" }}
      empty={homeEmpty(`No ${word("Services").toLowerCase()} yet.`)}
    />
  );
}
