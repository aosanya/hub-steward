import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { correctPhone, readProfile, type Profile } from "./profile";

type Loaded = { kind: "loading" } | { kind: "unreached" } | { kind: "ready"; profile: Profile };
type Saving = "idle" | "saved" | "failed";

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
    } catch {
      setSaving("failed");
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
            error={saving === "failed" ? words.profileNotSaved : undefined}
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
