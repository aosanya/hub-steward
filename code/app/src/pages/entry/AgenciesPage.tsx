import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { agencyHomePath } from "../../agency/open";
import { entryClient, type Agency, type DirectoryAgency, type JoinOutcome } from "../../entry/api";
import { useLanguage } from "../../entry/language";
import { formsWaiting, waitingCount } from "../../entry/waiting";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";

type View = { name: "list" } | { name: "find" } | { name: "agency"; agency: DirectoryAgency };
type Loaded = { kind: "loading" } | { kind: "ready"; agencies: Agency[] } | { kind: "unreached" };

function Find({ onPick }: { onPick: (a: DirectoryAgency) => void }) {
  const { words } = useLanguage();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<DirectoryAgency[] | null>(null);
  const [failed, setFailed] = useState(false);

  const search = async (q: string) => {
    try {
      setFound(await entryClient().searchDirectory(q));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    void search("");
  }, []);

  return (
    <>
      <Field label={words.findAgencyQuery} value={query} onChange={(e) => setQuery(e.target.value)} />
      <Button onClick={() => search(query.trim())}>{words.findAgencySearch}</Button>
      {failed ? <LoadFailed words={words.findAgencyUnreached} /> : null}
      {found && found.length === 0 ? <EmptyCard words={words.findAgencyNoneTitle} /> : null}
      <Rows>
        {(found ?? []).map((a) => (
          <ListRow key={a.id} title={a.name} lead meta={a.kind} onClick={() => onPick(a)} />
        ))}
      </Rows>
    </>
  );
}

function AgencyDetail({ agency }: { agency: DirectoryAgency }) {
  const { words } = useLanguage();
  const joinMessage: Record<JoinOutcome, string> = {
    joined: words.agencyJoined,
    requested: words.agencyRequested,
    failed: words.agencyJoinFailed,
  };
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const label = agency.joinMode === "open" ? words.agencyJoin : words.agencyAskToJoin;
  return (
    <>
      <section className="band">
        <span className="q">{words.agencyPurpose}</span>
        <p>{agency.purpose}</p>
      </section>
      {outcome ? (
        <p role="status">{joinMessage[outcome]}</p>
      ) : (
        <Button kind="primary" onClick={async () => setOutcome(await entryClient().join(agency.id))}>
          {label}
        </Button>
      )}
    </>
  );
}

export function AgenciesPage() {
  const { words } = useLanguage();
  const [view, setView] = useState<View>({ name: "list" });
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [waiting, setWaiting] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (loaded.kind !== "ready" || loaded.agencies.length < 2) return;
    let live = true;
    loaded.agencies.forEach((a) =>
      waitingCount(a.id)
        .then((count) => live && setWaiting((known) => ({ ...known, [a.id]: count })))
        .catch(() => undefined),
    );
    return () => {
      live = false;
    };
  }, [loaded]);

  useEffect(() => {
    let live = true;
    entryClient()
      .listAgencies()
      .then((agencies) => live && setLoaded({ kind: "ready", agencies }))
      .catch(() => live && setLoaded({ kind: "unreached" }));
    return () => {
      live = false;
    };
  }, []);

  if (loaded.kind === "ready" && loaded.agencies.length === 1 && view.name === "list") {
    return <Navigate to={agencyHomePath(loaded.agencies[0].id)} replace />;
  }
  if (view.name === "agency") {
    return (
      <Shell tabless unnamed title={view.agency.name} onBack={() => setView({ name: "find" })}>
        <AgencyDetail agency={view.agency} />
      </Shell>
    );
  }
  if (view.name === "find") {
    return (
      <Shell tabless unnamed title={words.findAgencyTitle} onBack={() => setView({ name: "list" })}>
        <Find onPick={(agency) => setView({ name: "agency", agency })} />
      </Shell>
    );
  }
  return (
    <Shell tabless unnamed title={words.agenciesTitle}>
      {loaded.kind === "unreached" ? <LoadFailed words={words.agenciesUnreached} /> : null}
      {loaded.kind === "ready" && loaded.agencies.length === 0 ? (
        <Card empty>
          <span className="ttl">{words.agenciesEmptyTitle}</span>
          <p>{words.agenciesEmptyBody}</p>
        </Card>
      ) : null}
      {loaded.kind === "ready" ? (
        <Rows>
          {loaded.agencies.map((a) => (
            <ListRow
              key={a.id}
              title={a.name}
              lead
              meta={waiting[a.id] ? formsWaiting(waiting[a.id], words) : ""}
              onClick={() => navigate(agencyHomePath(a.id))}
            />
          ))}
        </Rows>
      ) : null}
      <Button onClick={() => setView({ name: "find" })}>{words.findAgencyTitle}</Button>
    </Shell>
  );
}
