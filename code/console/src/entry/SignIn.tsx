import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useSession } from "../session";
import { Button, Card, Row } from "../ui";
import { listHubs, reasonOf, signIn } from "../wakala/rest";
import { EntryField } from "./EntryField";
import { EntryScreen } from "./EntryScreen";
import { ErrorLine } from "./ErrorLine";
import { landingPath } from "./Gate";

export function SignIn() {
  const { t } = useI18n();
  const { startSession, expired } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const reply = await signIn({ email, password }).catch(() => null);
      if (!reply?.ok) {
        setError(reasonOf(reply, t("submitFailed")));
        return;
      }
      const hubs = await listHubs().catch(() => null);
      if (!hubs) {
        setError(t("submitFailed"));
        return;
      }
      startSession(hubs);
      navigate(landingPath(hubs));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EntryScreen>
      <Card title={t("logIn")} className="ent-card">
        <form className="ent-form" onSubmit={submit}>
          <EntryField label={t("email")} icon="user" type="email" autoComplete="username" value={email} onChange={setEmail} />
          <EntryField
            label={t("password")}
            icon="lock"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          {expired ? <ErrorLine>{t("signedOut")}</ErrorLine> : null}
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          <Row>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? <span className="tool-spin" aria-hidden="true" /> : null}
              {t("logIn")}
            </Button>
          </Row>
        </form>
      </Card>
    </EntryScreen>
  );
}
