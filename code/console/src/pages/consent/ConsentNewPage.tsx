import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hubPath } from "../../api";
import { loadInForceText, publishConsentVersion } from "../../data/consent";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Card, Field, Stack, TitleRow, useNotice } from "../../ui";

const textSpec = { name: "consent", component: "textarea", required: true } as const;

function ConsentForm({ hubId, start }: { hubId: string; start: string }) {
  const { t } = useI18n();
  const { show } = useNotice();
  const navigate = useNavigate();
  const [text, setText] = useState(start);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const back = () => navigate(hubPath(hubId, "consent"));

  const publish = async () => {
    const empty = text.trim() === "";
    setRefused(empty);
    if (empty) return;
    setBusy(true);
    const number = await publishConsentVersion(hubId, text).catch(() => null);
    setBusy(false);
    if (number === null) return show(t("submitFailed"), "bad");
    show(t("consent.published").replace("{n}", number));
    back();
  };

  return (
    <div className="content">
      <Card>
        <Stack>
          <Field spec={textSpec} value={text} onChange={(value) => setText(String(value))} error={refused ? t("required") : undefined} />
        </Stack>
        <div className="form-foot">
          <Button disabled={busy} onClick={publish}>
            {t("consent.publish")}
          </Button>
          <Button kind="quiet" onClick={back}>
            {t("cancel")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function ConsentNewPage() {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state } = useLoaded(() => loadInForceText(hub.id), [hub.id]);

  return (
    <>
      <TitleRow title={t("consent.newVersion")} />
      {state.kind === "ready" ? <ConsentForm key={hub.id} hubId={hub.id} start={state.value} /> : null}
    </>
  );
}
