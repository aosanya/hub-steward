import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { duplicateWords } from "../../shared/wakala/duplicateWords";
import { McpError } from "../../shared/wakala/mcp";
import { Shell } from "../../app/Shell";
import { correctPhone, readProfile, type Profile } from "./profile";

type Loaded = { kind: "loading" } | { kind: "unreached" } | { kind: "ready"; profile: Profile };
type Saving = "idle" | "saved" | "failed" | "taken";

export function ProfilePage() {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState<Saving>("idle");

  useEffect(() => {
    let live = true;
    readProfile()
      .then((profile) => {
        if (!live) return;
        setPhone(profile.phone);
        setLoaded({ kind: "ready", profile });
      })
      .catch(() => live && setLoaded({ kind: "unreached" }));
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    try {
      setPhone((await correctPhone(phone.trim())).phone);
      setSaving("saved");
    } catch (error) {
      setSaving(error instanceof McpError && duplicateWords(error.message) ? "taken" : "failed");
    }
  };

  return (
    <Shell tabless title={words.profileTitle} onBack={() => navigate(-1)}>
      {loaded.kind === "loading" ? <LoadingLine words={words.profileLoading} /> : null}
      {loaded.kind === "unreached" ? <LoadFailed words={words.profileUnreached} /> : null}
      {loaded.kind === "ready" ? (
        <>
          <Rows>
            <ListRow title={loaded.profile.name} code={loaded.profile.code} lead />
          </Rows>
          <Field
            label={words.profilePhone}
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaving("idle");
            }}
            error={saving === "failed" ? words.profileNotSaved : saving === "taken" ? words.profilePhoneTaken : undefined}
          />
          <Button kind="primary" onClick={save}>
            {words.profileSave}
          </Button>
          {saving === "saved" ? <p className="note" role="status">{words.profileSaved}</p> : null}
        </>
      ) : null}
    </Shell>
  );
}
