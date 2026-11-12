import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLanguage } from "../entry/language";
import { doSomethingPath } from "../routes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { agree, readInForce, type ConsentText } from "./api";
import { settle } from "./settled";

type Loaded = { kind: "loading" } | { kind: "unreached" } | { kind: "ready"; consent: ConsentText };

export function ConsentPage() {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const agencyId = openAgencyId();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    readInForce(agencyId)
      .then((consent) => live && setLoaded(consent ? { kind: "ready", consent } : { kind: "unreached" }))
      .catch(() => live && setLoaded({ kind: "unreached" }));
    return () => {
      live = false;
    };
  }, [agencyId]);

  const give = async () => {
    try {
      await agree(agencyId);
      settle(agencyId);
      navigate(doSomethingPath(), { replace: true });
    } catch {
      setFailed(true);
    }
  };

  return (
    <Shell tabless title={words.consentTitle}>
      {loaded.kind === "loading" ? <LoadingLine words={words.consentLoading} /> : null}
      {loaded.kind === "unreached" ? <LoadFailed words={words.consentUnreached} /> : null}
      {loaded.kind === "ready" ? (
        <>
          <Card>
            {loaded.consent.clauses.map((clause) => (
              <p key={clause}>{clause}</p>
            ))}
          </Card>
          <Button kind="primary" onClick={give}>
            {words.consentAgree}
          </Button>
          {failed ? <p className="note" role="alert">{words.consentNotSaved}</p> : null}
        </>
      ) : null}
    </Shell>
  );
}
