import { useState, type FormEvent } from "react";
import { makeAccessKey, type MadeKey } from "../../data/accessKeys";
import { useI18n } from "../../i18n";
import { Button, Card, Field, Stack } from "../../ui";
import { NewKey } from "./NewKey";

const nameSpec = { name: "name", component: "text", required: true } as const;

type MakeKeyProps = { hubId: string; onMade: () => void };

export function MakeKey({ hubId, onMade }: MakeKeyProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [refusal, setRefusal] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<MadeKey | null>(null);

  const make = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") return setRefusal(t("required"));
    setBusy(true);
    setRefusal(undefined);
    try {
      setMade(await makeAccessKey(hubId, name.trim()));
      setName("");
      onMade();
    } catch (failure) {
      setMade(null);
      setRefusal(failure instanceof Error && failure.message !== "" ? failure.message : t("submitFailed"));
    }
    setBusy(false);
  };

  return (
    <>
      <form noValidate onSubmit={make}>
        <Card>
          <Stack>
            <Field spec={nameSpec} value={name} onChange={(value) => setName(String(value))} error={refusal} />
          </Stack>
          <div className="form-foot">
            <Button type="submit" disabled={busy}>
              {t("accessKeys.makeKey")}
            </Button>
          </div>
        </Card>
      </form>
      {made ? <NewKey made={made} /> : null}
    </>
  );
}
