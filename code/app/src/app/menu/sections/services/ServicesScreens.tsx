import { useState, type ComponentProps } from "react";
import { Button } from "../../../../shared/ui/Button";
import { dayWords } from "../../../../shared/ui/days";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";

const paidStatus = "paid";

const paidWords = "Paid";

function ServicesList(props: Omit<ComponentProps<typeof MenuList>, "bare">) {
  const back = useBackToSection();
  return (
    <Shell title={props.title} titleUnder tabless {...back}>
      <MenuList {...props} bare />
    </Shell>
  );
}

const isPaid = (submission: Item) => text(submission, "status").toLocaleLowerCase() === paidStatus;

const submissionRow = (submission: Item) => ({
  id: text(submission, "id"),
  name: text(submission, "name"),
  line: [text(submission, "status"), dayWords(text(submission, "sent_at"))].filter((part) => part !== "").join(" · "),
  form_id: text(submission, "form_id"),
  member_id: text(submission, "member_id"),
  paid: isPaid(submission),
});

const loadKind = (kind: string) => async () =>
  (await listOf("forms_submission_list")).filter((submission) => text(submission, "kind") === kind).map(submissionRow);

const loadFees = async () => {
  const fees = await loadKind("fee")();
  return [...fees.filter((fee) => !fee.paid), ...fees.filter((fee) => fee.paid)];
};

function MarkFeePaidButton({ fee }: { fee: Item }) {
  const [phase, setPhase] = useState<"idle" | "busy" | "failed" | "paid">("idle");
  const markPaid = async () => {
    setPhase("busy");
    try {
      await callTool("", "forms_submission_mark_paid", { form_id: text(fee, "form_id"), member_id: text(fee, "member_id"), paid: true });
      setPhase("paid");
    } catch {
      setPhase("failed");
    }
  };
  if (phase === "paid") return <span>{paidWords}</span>;
  return (
    <>
      <Button kind="primary" disabled={phase === "busy"} onClick={markPaid}>Mark paid</Button>
      {phase === "failed" ? <LoadFailed words={actionFailedWords} /> : null}
    </>
  );
}

export function PermitsScreen() {
  return (
    <ServicesList title="Permits" tool="forms_submission_list" load={loadKind("permit")} fields={{ title: "name", meta: "line" }} empty={homeEmpty("No permits yet.")} />
  );
}

export function LicencesScreen() {
  return (
    <ServicesList title="Licences" tool="forms_submission_list" load={loadKind("licence")} fields={{ title: "name", meta: "line" }} empty={homeEmpty("No licences yet.")} />
  );
}

export function FeesPaymentsScreen() {
  return (
    <ServicesList
      title="Fees & Payments"
      tool="forms_submission_list"
      load={loadFees}
      fields={{ title: "name", meta: "line" }}
      empty={homeEmpty("No fees yet.")}
      end={(fee) => (fee.paid === true ? <span>{paidWords}</span> : <MarkFeePaidButton fee={fee} />)}
    />
  );
}

const catalogueRow = (entry: Item) => ({ id: text(entry, "id"), name: text(entry, "name"), line: text(entry, "summary") });

export function ServiceCatalogueScreen() {
  const load = async () => (await listOf("forms_catalog_entry_list_public")).map(catalogueRow);
  return (
    <ServicesList title="Service Catalogue" tool="forms_catalog_entry_list_public" load={load} fields={{ title: "name", meta: "line" }} empty={homeEmpty("No services yet.")} />
  );
}
