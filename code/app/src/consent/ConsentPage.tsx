import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLanguage } from "../entry/language";
import { filled } from "../risks/labels";
import { doSomethingPath } from "../routes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { agree, readInForce, readMine, versionNumber, withdraw, type ConsentText, type MyConsent } from "./api";
import { settle, unsettle } from "./settled";

type Loaded = { kind: "loading" } | { kind: "unreached" } | { kind: "ready"; consent: ConsentText; mine: MyConsent };
type Failure = "none" | "agree" | "withdraw";

export function ConsentPage() {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const agencyId = openAgencyId();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [failure, setFailure] = useState<Failure>("none");

  useEffect(() => {
    let live = true;
    Promise.all([readInForce(agencyId), readMine(agencyId)])
      .then(([consent, mine]) => live && setLoaded(consent ? { kind: "ready", consent, mine } : { kind: "unreached" }))
      .catch(() => live && setLoaded({ kind: "unreached" }));
    return () => {
      live = false;
    };
  }, [agencyId]);

  const showing = (consent: ConsentText, mine: MyConsent) => {
    setFailure("none");
    setLoaded({ kind: "ready", consent, mine });
  };

  const give = async (consent: ConsentText, was: MyConsent) => {
    try {
      await agree(agencyId);
      settle(agencyId);
      if (was === "none") navigate(doSomethingPath(), { replace: true });
      else showing(consent, "agreed");
    } catch {
      setFailure("agree");
    }
  };

  const takeBack = async (consent: ConsentText) => {
    try {
      await withdraw(agencyId);
      unsettle(agencyId);
      showing(consent, "withdrawn");
    } catch {
      setFailure("withdraw");
    }
  };

  if (loaded.kind !== "ready") {
    return (
      <Shell tabless title={words.consentTitle}>
        {loaded.kind === "loading" ? <LoadingLine words={words.consentLoading} /> : <LoadFailed words={words.consentUnreached} />}
      </Shell>
    );
  }

  const { consent, mine } = loaded;
  const sub =
    mine === "agreed"
      ? filled(words.consentAgreedTo, { version: versionNumber(consent.version) })
      : mine === "withdrawn"
        ? words.consentWithdrew
        : undefined;
  const back = mine === "none" ? undefined : () => navigate(-1);

  return (
    <Shell tabless title={words.consentTitle} sub={sub} onBack={back}>
      <Card>
        {consent.clauses.map((clause) => (
          <p key={clause}>{clause}</p>
        ))}
      </Card>
      {mine === "agreed" ? (
        <Button onClick={() => takeBack(consent)}>{words.consentWithdraw}</Button>
      ) : (
        <Button kind="primary" onClick={() => give(consent, mine)}>
          {mine === "none" ? words.consentAgree : words.consentAgreeAgain}
        </Button>
      )}
      {failure !== "none" ? (
        <p className="note" role="alert">
          {failure === "agree" ? words.consentNotSaved : words.consentNotWithdrawn}
        </p>
      ) : null}
    </Shell>
  );
}
