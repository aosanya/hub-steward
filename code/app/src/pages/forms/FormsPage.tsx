import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WaitingForm } from "../../forms/api";
import { useForms } from "../../forms/context";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed, LoadingLine } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { isoDay } from "../../ui/days";
import { Segmented } from "../../ui/Segmented";
import { Shell } from "../../ui/Shell";
import { draftCount } from "./answers";

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

export function FormsPage() {
  const forms = useForms();
  const go = useNavigate();
  const [view, setView] = useState<View>("waiting");
  const [everyAnswered, setEveryAnswered] = useState(false);
  const waiting = useLoad(() => forms.waiting(), "waiting");
  const answered = useLoad(() => forms.answered(), "answered");
  const standing = useLoad(() => forms.standing(), "standing");
  const waitingCount = waiting.state === "ready" ? ` · ${waiting.data.length}` : "";
  const openAnswered = answered.state === "ready" ? newestFirst(answered.data.filter((f) => f.open)) : [];
  const shownAnswered = answered.state === "ready" ? (everyAnswered ? newestFirst(answered.data) : openAnswered) : [];
  const answeredCount = answered.state === "ready" ? ` · ${openAnswered.length}` : "";

  return (
    <Shell title="Forms">
      <Segmented
        items={[
          { id: "waiting", label: `Waiting${waitingCount}` },
          { id: "answered", label: `Answered${answeredCount}` },
        ]}
        current={view}
        onChange={setView}
      />
      {view === "waiting" ? (
        <>
          {waiting.state === "loading" ? <LoadingLine words="Loading forms" /> : null}
          {waiting.state === "error" ? <LoadFailed words="Forms could not be loaded" /> : null}
          {waiting.state === "ready" && waiting.data.length === 0 ? (
            <EmptyCard words="Nothing is waiting for you">
              <p className="meta">New forms from your groups show up here and in your Inbox.</p>
              <Button onClick={() => setView("answered")}>See what you answered</Button>
            </EmptyCard>
          ) : null}
          {waiting.state === "ready" && waiting.data.length > 0 ? (
            <>
              {groupByClosing(waiting.data, Date.now()).map((g) => (
                <div key={g.heading}>
                  <h2>{g.heading}</h2>
                  <Rows>
                    {g.items.map((f) => {
                      const kept = draftCount(f.form_id);
                      return (
                        <ListRow
                          key={f.form_id}
                          title={f.title}
                          meta={[sender(f), `${f.questions} questions, closes ${isoDay(f.closes_at)}`]}
                          end={kept > 0 && !f.answered ? <Chip tone="accent">{`Draft · ${kept} of ${f.questions}`}</Chip> : f.answered ? <Chip tone="success">Sent</Chip> : <Chip tone="accent">New</Chip>}
                          onClick={() => go(routes.form.path({ id: f.form_id }), { state: { title: f.title } })}
                        />
                      );
                    })}
                  </Rows>
                </div>
              ))}
            </>
          ) : null}
          {standing.state === "ready" && standing.data.length > 0 ? (
            <>
              <h2>Ask for something</h2>
              <Rows>
                {standing.data.map((f) => (
                  <ListRow
                    key={f.form_id}
                    title={f.title}
                    meta="Open any time"
                    end="›"
                    onClick={() => go(routes.form.path({ id: f.form_id }), { state: { title: f.title, standing: f.landing === "thread" } })}
                  />
                ))}
              </Rows>
            </>
          ) : null}
        </>
      ) : (
        <>
          {answered.state === "loading" ? <LoadingLine words="Loading answered forms" /> : null}
          {answered.state === "error" ? <LoadFailed words="Answered forms could not be loaded" /> : null}
          {answered.state === "ready" && answered.data.length === 0 ? <EmptyCard words="You have not answered any form yet" /> : null}
          {answered.state === "ready" && answered.data.length > 0 && shownAnswered.length === 0 ? <EmptyCard words="None of the forms you answered is open" /> : null}
          {shownAnswered.length > 0 ? (
            <Rows>
              {shownAnswered.map((f) => (
                <ListRow
                  key={f.send_id}
                  title={f.title}
                  meta={`Sent ${isoDay(f.answered_at)}`}
                  end={everyAnswered ? <Chip>{f.open ? "Open" : "Closed"}</Chip> : undefined}
                  onClick={f.open ? () => go(routes.form.path({ id: f.form_id }), { state: { title: f.title } }) : undefined}
                />
              ))}
            </Rows>
          ) : null}
          {answered.state === "ready" && answered.data.length > 0 && !everyAnswered ? <Button onClick={() => setEveryAnswered(true)}>Every form you answered</Button> : null}
        </>
      )}
    </Shell>
  );
}
