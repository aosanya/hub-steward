import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { hubPath } from "../api";
import { useI18n } from "../i18n";
import { useSession } from "../session";
import type { Hub } from "../types";
import { Button, Card, Row } from "../ui";
import { reasonOf, signIn } from "../wakala/rest";
import { readText } from "../pages/spec/documentsUpload";
import { AgencyFilePicker } from "./AgencyFilePicker";
import { readAgency, type AgencyFile } from "./agencyFile";
import { countsOf } from "./counts";
import { CreateProgress, type Phase } from "./CreateProgress";
import { EntryField } from "./EntryField";
import { EntryScreen } from "./EntryScreen";
import { ErrorLine } from "./ErrorLine";
import { SetupFailure, configuredTemplate, setUpHub } from "./hubSetup";
import { TemplatePicker } from "./TemplatePicker";
import { templateOf, templates } from "./templates";

const firstTemplate = templates[0].id;

export function CreateHub() {
  const { t } = useI18n();
  const { signedIn, startSession, addHub } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [credentialsAsked, setCredentialsAsked] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [configured, setConfigured] = useState(firstTemplate);
  const [upload, setUpload] = useState<File | null>(null);
  const [agency, setAgency] = useState<AgencyFile | null>(null);
  const [fileFailed, setFileFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const showCredentials = !signedIn || credentialsAsked;
  const chosen = templateOf(picked ?? configured);

  useEffect(() => {
    let current = true;
    configuredTemplate().then((id) => {
      if (current && templates.some((template) => template.id === id)) setConfigured(id);
    });
    return () => {
      current = false;
    };
  }, []);

  const pickFile = async (file: File | null) => {
    setUpload(file);
    setAgency(null);
    setFileFailed(false);
    if (!file) return;
    const read = readAgency(await readText(file).catch(() => ""));
    if (!read) return setFileFailed(true);
    setAgency(read);
    setName((current) => (current.trim() === "" ? read.name : current));
  };

  const pickTemplate = (id: string) => {
    setPicked(id);
    void pickFile(null);
  };

  const signInFirst = async () => {
    const reply = await signIn({ email, password }).catch(() => null);
    if (reply?.ok) return true;
    setError(reasonOf(reply, t("submitFailed")));
    return false;
  };

  const messageOf = (failure: unknown) => {
    if (!(failure instanceof SetupFailure)) return t("submitFailed");
    return "key" in failure.reason ? t(failure.reason.key) : failure.reason.text;
  };

  const explain = (failure: unknown, created: Hub | null) => {
    const message = messageOf(failure);
    const unauthorized = failure instanceof SetupFailure && failure.unauthorized;
    if (failure instanceof SetupFailure && failure.stage > 0 && !unauthorized) {
      setPhase({ kind: "failed", done: failure.stage, message, hub: created });
      return;
    }
    setPhase({ kind: "form" });
    setError(message);
    if (unauthorized) setCredentialsAsked(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const hubName = name.trim();
    if (hubName === "") return setError(t("hubNameRequired"));
    if (showCredentials && !(await signInFirst())) return;
    setPhase({ kind: "creating", done: 0, hub: null });
    let created: Hub | null = null;
    try {
      const hub = await setUpHub(hubName, agency?.document ?? chosen.id, (done, importedHub) => {
        created = importedHub;
        setPhase({ kind: "creating", done, hub: importedHub });
      });
      if (signedIn) addHub(hub);
      else startSession([hub]);
      setPhase({ kind: "ready", hub });
    } catch (failure) {
      explain(failure, created);
    }
  };

  const openStatus = (hub: Hub) => navigate(hubPath(hub.id, "status"));

  if (phase.kind !== "form") {
    return (
      <EntryScreen>
        <CreateProgress
          phase={phase}
          counts={countsOf(agency ?? chosen, t)}
          onOpen={openStatus}
          onBack={() => setPhase({ kind: "form" })}
          onHubs={() => navigate("/hubs")}
        />
      </EntryScreen>
    );
  }

  return (
    <EntryScreen>
      <Card title={t("create")} className="ent-card ent-wide">
        <form className="ent-form" onSubmit={submit}>
          <EntryField label={t("hubName")} icon="people" autoComplete="off" value={name} onChange={setName} />
          <TemplatePicker chosen={agency ? "" : chosen.id} onChoose={pickTemplate} />
          <AgencyFilePicker file={upload} agency={agency} failed={fileFailed} onPick={pickFile} />
          {showCredentials && (
            <>
              <EntryField label={t("email")} icon="user" type="email" autoComplete="username" value={email} onChange={setEmail} />
              <EntryField
                label={t("password")}
                icon="lock"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
              />
            </>
          )}
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          <Row>
            <Button type="submit">{t("create")}</Button>
            <Button kind="quiet" onClick={() => navigate("/start")}>
              {t("back")}
            </Button>
          </Row>
        </form>
      </Card>
    </EntryScreen>
  );
}
