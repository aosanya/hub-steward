import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { entryClient, type LinkOutcome } from "./api";
import { useLanguage } from "./language";
import { hubIsLocal } from "./localHub";
import { signInWithPassword, type PasswordOutcome } from "./passwordSignIn";
import { Button } from "../shared/ui/Button";
import { Field } from "../shared/ui/Field";
import { LanguageChoice } from "../shared/ui/LanguageChoice";
import { Shell } from "../shared/ui/Shell";
import { resetMcp } from "../shared/wakala/mcp";
import { forgetSubject } from "../shared/wakala/me";

export function SignInPage() {
  const arrival = new URLSearchParams(useLocation().search);
  const linkFailed = arrival.get("link") !== null;
  const ended = arrival.get("ended") !== null;
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<LinkOutcome | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [local, setLocal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordOutcome, setPasswordOutcome] = useState<PasswordOutcome | null>(null);
  const navigate = useNavigate();
  const { words } = useLanguage();
  useEffect(() => {
    let alive = true;
    hubIsLocal().then((yes) => alive && setLocal(yes));
    return () => {
      alive = false;
    };
  }, []);

  const refusal: Record<Exclude<LinkOutcome, "sent">, string> = {
    invalid: words.signInInvalid,
    busy: words.signInBusy,
    unavailable: words.signInUnavailable,
    offline: words.signInOffline,
  };

  if (choosing) {
    return (
      <Shell tabless title={words.selectLanguageTitle} onBack={() => setChoosing(false)}>
        <LanguageChoice onChosen={() => setChoosing(false)} />
      </Shell>
    );
  }

  const passwordRefusal: Record<Exclude<PasswordOutcome, "in">, string> = {
    wrong: words.signInWrong,
    busy: words.signInBusy,
    unavailable: words.signInUnavailable,
    offline: words.signInOffline,
  };

  const signInHere = async () => {
    const outcome = await signInWithPassword(email.trim(), password);
    if (outcome !== "in") {
      setPasswordOutcome(outcome);
      return;
    }
    forgetSubject();
    resetMcp();
    navigate("/", { replace: true });
  };

  const send = async () => setOutcome(await entryClient().sendSignInLink(email.trim(), `${window.location.origin}/sign-in/link`));

  return (
    <Shell tabless title={words.signInTitle}>
      {linkFailed ? <p role="alert">{words.signInLinkFailed}</p> : ended ? <p role="alert">{words.signInSessionEnded}</p> : null}
      <Field
        label={words.signInEmail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={outcome && outcome !== "sent" ? refusal[outcome] : undefined}
      />
      <Button kind="primary" onClick={send}>
        {words.signInSend}
      </Button>
      {outcome === "sent" ? <p className="note">{words.signInSent}</p> : null}
      {local ? (
        <>
          <Field
            label={words.signInPassword}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordOutcome && passwordOutcome !== "in" ? passwordRefusal[passwordOutcome] : undefined}
          />
          <Button onClick={signInHere}>{words.signInWithPassword}</Button>
        </>
      ) : null}
      <Button onClick={() => setChoosing(true)}>{words.changeLanguage}</Button>
    </Shell>
  );
}
