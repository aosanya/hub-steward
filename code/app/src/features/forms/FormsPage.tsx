import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AnsweredForm, StandingForm, WaitingForm } from "./api";
import { useForms } from "./context";
import { useLoad } from "./useLoad";
import { MenuWindow } from "../../app/menu/MenuWindow";
import { routes } from "../../app/routes";
import { Button } from "../../shared/ui/Button";
import { Chip, type ChipTone } from "../../shared/ui/Chip";
import { isoDay } from "../../shared/ui/days";
import { Segmented } from "../../shared/ui/Segmented";
import { draftCount, formDraftKey } from "./answers";

const sender = (f: WaitingForm) => [f.group, f.publishing_authority || f.publisher_name].filter(Boolean).join(" · ");

const weekMs = 7 * 24 * 60 * 60 * 1000;

export const groupByClosing = <T extends { closes_at: string }>(items: T[], now: number) => {
  const sorted = [...items].sort((a, b) => a.closes_at.localeCompare(b.closes_at));
  const soon = sorted.filter((f) => f.closes_at !== "" && Date.parse(f.closes_at) - now <= weekMs);
  const later = sorted.filter((f) => !soon.includes(f));
  return [
    { heading: "Closes this week", items: soon },
    { heading: "Later", items: later },
  ].filter((g) => g.items.length > 0);
};

const newestFirst = <T extends { answered_at: string }>(items: T[]) => [...items].sort((a, b) => b.answered_at.localeCompare(a.answered_at));

type View = "waiting" | "answered";

type Entry = {
  id: string;
  kind: View | "standing";
  form_id: string;
  title: string;
  meta: string;
  closes_at: string;
  sender: string;
  questions: number | "";
  closes: string;
  sent: string;
  state: string;
  tone: ChipTone | "";
  chip: boolean;
  open: boolean;
  thread: boolean;
};

const blank: Entry = { id: "", kind: "waiting", form_id: "", title: "", meta: "", closes_at: "", sender: "", questions: "", closes: "", sent: "", state: "", tone: "", chip: true, open: true, thread: false };

const waitingState = (f: WaitingForm): Pick<Entry, "state" | "tone"> => {
  const kept = draftCount(formDraftKey(f.form_id));
  if (f.answered) return { state: "Sent", tone: "success" };
  return kept > 0 ? { state: `Draft · ${kept} of ${f.questions}`, tone: "accent" } : { state: "New", tone: "accent" };
};

const waitingEntry = (f: WaitingForm): Entry => ({
  ...blank,
  ...waitingState(f),
  id: f.form_id,
  form_id: f.form_id,
  title: f.title,
  meta: [sender(f), `${f.questions} questions, closes ${isoDay(f.closes_at)}`].filter(Boolean).join(" · "),
  closes_at: f.closes_at,
  sender: sender(f),
  questions: f.questions,
  closes: isoDay(f.closes_at),
});

const standingEntry = (f: StandingForm): Entry => ({ ...blank, id: f.form_id, kind: "standing", form_id: f.form_id, title: f.title, meta: "Open any time", thread: f.landing === "thread" });

const answeredEntry = (every: boolean) => (f: AnsweredForm): Entry => ({
  ...blank,
  id: f.send_id,
  kind: "answered",
  form_id: f.form_id,
  title: f.title,
  meta: `Sent ${isoDay(f.answered_at)}`,
  sent: isoDay(f.answered_at),
  state: f.open ? "Open" : "Closed",
  chip: every,
  open: f.open,
});

const asEntry = (item: Record<string, unknown>) => item as Entry;

const standingHeading = "Ask for something";

const groupsOf = (items: Record<string, unknown>[]) => {
  const entries = items.map(asEntry);
  const standing = entries.filter((e) => e.kind === "standing");
  const closing = groupByClosing(entries.filter((e) => e.kind !== "standing"), Date.now());
  return [...closing, ...(standing.length > 0 ? [{ heading: standingHeading, items: standing }] : [])];
};

const endOf = (item: Record<string, unknown>) => {
  const entry = asEntry(item);
  if (entry.kind === "standing") return "›";
  return entry.chip && entry.state ? <Chip tone={entry.tone || undefined}>{entry.state}</Chip> : undefined;
};

const listFields = { title: "title", meta: "meta" };

const detailFields = { Form: "title", From: "sender", Questions: "questions", Closes: "closes", Sent: "sent" };

export function FormsPage() {
  const forms = useForms();
  const go = useNavigate();
  const [view, setView] = useState<View>("waiting");
  const [everyAnswered, setEveryAnswered] = useState(false);
  const waitingForms = useMemo(() => forms.waiting(), [forms]);
  const answeredForms = useMemo(() => forms.answered(), [forms]);
  const standingForms = useMemo(() => forms.standing().catch((): StandingForm[] => []), [forms]);
  const waiting = useLoad(() => waitingForms, "waiting");
  const answered = useLoad(() => answeredForms, "answered");
  const waitingEntries = () => Promise.all([waitingForms, standingForms]).then(([w, s]) => [...w.map(waitingEntry), ...s.map(standingEntry)]);
  const answeredEntries = () => answeredForms.then((all) => newestFirst(everyAnswered ? all : all.filter((f) => f.open)).map(answeredEntry(everyAnswered)));
  const entries = view === "waiting" ? waitingEntries : answeredEntries;
  const waitingCount = waiting.state === "ready" ? ` · ${waiting.data.length}` : "";
  const answeredCount = answered.state === "ready" ? ` · ${answered.data.filter((f) => f.open).length}` : "";
  const nothingAnswered = answered.state === "ready" && answered.data.length === 0;

  const open = (item: Record<string, unknown>) => {
    const entry = asEntry(item);
    go(routes.form.path({ id: entry.form_id }), { state: entry.kind === "standing" ? { title: entry.title, standing: entry.thread } : { title: entry.title } });
  };

  const list =
    view === "waiting"
      ? {
          title: "Waiting",
          tool: "forms_form_list_waiting",
          fields: listFields,
          empty: {
            words: "Nothing is waiting for you",
            children: (
              <>
                <p className="meta">New forms from your groups show up here and on Home.</p>
                <Button onClick={() => setView("answered")}>See what you answered</Button>
              </>
            ),
          },
          load: waitingEntries,
          end: endOf,
          groups: groupsOf,
          loadingWords: "Loading forms",
          failedWords: "Forms could not be loaded",
        }
      : {
          title: "Answered",
          tool: "forms_form_list_answered",
          fields: listFields,
          empty: { words: nothingAnswered ? "You have not answered any form yet" : "None of the forms you answered is open" },
          load: answeredEntries,
          end: endOf,
          loadingWords: "Loading answered forms",
          failedWords: "Answered forms could not be loaded",
        };

  return (
    <MenuWindow
      key={`${view}-${everyAnswered}`}
      title="Forms"
      list={list}
      detail={{
        tool: "forms_form_read",
        fields: detailFields,
        status: "state",
        action: { label: "Open form", tool: "forms_form_read", run: open, when: (item) => asEntry(item).open },
        load: async (id) => (await entries()).find((entry) => entry.id === id) ?? {},
      }}
      above={
        <Segmented
          items={[
            { id: "waiting", label: `Waiting${waitingCount}` },
            { id: "answered", label: `Answered${answeredCount}` },
          ]}
          current={view}
          onChange={setView}
        />
      }
      below={
        view === "answered" && answered.state === "ready" && answered.data.length > 0 && !everyAnswered ? (
          <Button onClick={() => setEveryAnswered(true)}>Every form you answered</Button>
        ) : null
      }
    />
  );
}
