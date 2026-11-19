import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dayWords } from "../../../../shared/ui/days";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { useWord } from "../../../../features/agency/useWord";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";
import { moneyWords, unitOf } from "../finance/financeData";
import { personNameOf } from "../residents/personName";
import { RecordOwner } from "../../RecordOwner";
import { CatalogueWindow } from "./CatalogueEntry";
import { ChatAboutService } from "./ChatAboutService";
import { servicesPaths } from "./paths";
import { certificateFields, certificateOf, decisionStatus, sentWords } from "./decision";
import { Granted } from "./Granted";
import { ServiceAct, ServiceDetails, ServiceHead } from "./ServicePage";
import { ReceivedApplications } from "./ReceivedApplications";
import { readItem } from "./readItem";

const paidWords = "Paid";

const markPaidLabel = "Mark paid";

const withdrawnWords = "Withdrawn";

const notSentWords = "Not sent yet";

const submissionsTool = "forms_catalog_entry_submissions_mine";

const listTool = "forms_catalog_entry_list_public";

const listFields = { title: "name", meta: "line" };

const detailFields = { "Sent on": "sent", ...certificateFields };

const feeDetailFields = { "Sent on": "sent", Amount: "amount" };

const isPaid = (submission: Item) => submission.paid === true;

const isWithdrawn = (submission: Item) => text(submission, "withdrawn_at") !== "";

const isOwing = (submission: Item) => !isPaid(submission) && !isWithdrawn(submission);

const byNewest = (a: Item, b: Item) => text(b, "submitted_at").localeCompare(text(a, "submitted_at"));

const statusOf = (submission: Item) => {
  if (isWithdrawn(submission)) return withdrawnWords;
  return decisionStatus(text(submission, "decision")) || (isPaid(submission) ? paidWords : sentWords);
};

const entryRow = (entry: Item) => ({ id: text(entry, "slug"), name: text(entry, "name"), line: text(entry, "summary") });

const loadKind = (kind: string) => async () => (await listOf(listTool, { kind })).map(entryRow);

const amountWords = (form: Item, unit: string) => (typeof form.amount === "number" && form.amount > 0 ? moneyWords(form.amount, unit) : "");

const feeDetails = async (submission: Item | undefined, unit: string) => {
  if (!submission) return { amount: "", payer: "", payer_id: "" };
  const [form, member] = await Promise.all([
    readItem("forms_form_read", { form_id: text(submission, "form_id") }),
    readItem("actor_get_actor", { actor_id: text(submission, "member_id") }),
  ]);
  return { amount: amountWords(form, unit), payer: personNameOf(member), payer_id: text(submission, "member_id") };
};

const entryOf = async (kind: string, slug: string) => (await listOf(listTool, { kind })).find((entry) => text(entry, "slug") === slug) ?? {};

const loadSubmissions = (fee: boolean, kind: string, unit: string) => async (slug: string) => {
  const [sent, entry] = await Promise.all([listOf(submissionsTool, { slug }).then((all) => all.sort(byNewest)), entryOf(kind, slug)]);
  return {
    id: slug,
    name: text(entry, "name"),
    summary: text(entry, "summary"),
    form: text(entry, "form_id"),
    payer_id: sent.length === 0 ? "" : text(sent[0], "member_id"),
    status: sent.length === 0 ? notSentWords : statusOf(sent[0]),
    sent: sent.map((submission) => dayWords(text(submission, "submitted_at"))).join(", "),
    owing: sent.filter(isOwing),
    ...(fee || sent.length === 0 ? {} : certificateOf(sent[0])),
    ...(fee ? await feeDetails(sent[0], unit) : {}),
  };
};

const markPaid = (submission: Item) =>
  callTool("", "forms_submission_mark_paid", { form_id: text(submission, "form_id"), member_id: text(submission, "member_id"), paid: true });

const extraOf = (item: Item, payable: boolean) =>
  Object.fromEntries([["form", text(item, "form")], ...(payable ? [["payer", text(item, "payer_id")]] : [])].filter(([, value]) => value !== ""));

type Kind = "permit" | "licence" | "fee";

const KindScreen = ({ generic, emptyGeneric, kind, payable, at }: { generic: string; emptyGeneric: string; kind: Kind; payable?: boolean; at: string }) => {
  const word = useWord("forms");
  const unit = unitOf(useWord("accounting"));
  const [search] = useSearchParams();
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
      startAt={search.get("item") ?? undefined}
      list={{ title, tool: listTool, fields: listFields, empty: homeEmpty(empty), load: loadKind(kind) }}
      withTabs
      bandless
      detail={{
        tool: submissionsTool,
        fields: {},
        status: "",
        load: loadSubmissions(payable === true, kind, unit),
        extra: (item: Item) => (
          <>
            <ChatAboutService about={{ kind, id: text(item, "id"), name: text(item, "name"), extra: extraOf(item, payable === true) }} back={`${at}?item=${text(item, "id")}`} />
            <ServiceHead title={text(item, "name") || text(item, "id")} status={text(item, "status")} line={text(item, "summary")} />
            <ServiceDetails
              word="Details"
              item={item}
              fields={payable ? feeDetailFields : detailFields}
              foot={action && action.when?.(item) ? <ServiceAct label={action.label} onClick={() => action.run?.(item)} /> : undefined}
            />
            {payable ? <RecordOwner heading="Payer" ownerId={text(item, "payer_id")} name={text(item, "payer")} /> : null}
            {payable ? null : (
              <>
                <ReceivedApplications slug={text(item, "id")} />
                <Granted slug={text(item, "id")} />
              </>
            )}
          </>
        ),
      }}
      below={failed ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
};

export const PermitsScreen = () => <KindScreen generic="Permits" emptyGeneric="Permits" kind="permit" at={servicesPaths.permits.path()} />;

export const LicencesScreen = () => <KindScreen generic="Licences" emptyGeneric="Licences" kind="licence" at={servicesPaths.licences.path()} />;

export const FeesPaymentsScreen = () => <KindScreen generic="Fees & Payments" emptyGeneric="Fees" kind="fee" payable at={servicesPaths.fees.path()} />;

export function ServiceCatalogueScreen() {
  const word = useWord("forms");
  return <CatalogueWindow title={word("Service Catalogue")} empty={`No ${word("Services").toLowerCase()} yet.`} back={servicesPaths.catalogue.path()} add={{ label: `Add ${word("Service").toLowerCase()}`, to: servicesPaths.catalogueNew.path() }} />;
}
