import { useState } from "react";
import { useLocation } from "react-router-dom";
import { entryClient, type LinkOutcome } from "../../entry/api";
import { useLanguage } from "../../entry/language";
import { languages } from "../../entry/words";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";

export function SignInPage() {
  const arrival = new URLSearchParams(useLocation().search);
  const linkFailed = arrival.get("link") !== null;
  const ended = arrival.get("ended") !== null;
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<LinkOutcome | null>(null);
  const [choosing, setChoosing] = useState(false);
  const { code: language, setLanguage, words } = useLanguage();
  const refusal: Record<Exclude<LinkOutcome, "sent">, string> = {
    invalid: words.signInInvalid,
    busy: words.signInBusy,
    unavailable: words.signInUnavailable,
    offline: words.signInOffline,
  };

  if (choosing) {
    return (
      <Shell tabless title={words.selectLanguageTitle} onBack={() => setChoosing(false)}>
        {languages.map((l) => (
          <Button
            key={l.code}
            kind={l.code === language ? "primary" : "quiet"}
            lang={l.code}
            aria-pressed={l.code === language}
            onClick={() => {
              setLanguage(l.code);
              setChoosing(false);
            }}
          >
            {l.name}
          </Button>
        ))}
      </Shell>
    );
  }

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
      <Button onClick={() => setChoosing(true)}>{words.changeLanguage}</Button>
    </Shell>
  );
}
