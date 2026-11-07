import { useState } from "react";
import { cornersFromText, loadBoundary, saveBoundary, textFromCorners, type Boundary } from "../../data/groupBoundary";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Card, Empty, Stack, TextareaControl, useNotice } from "../../ui";

const size = 240;
const margin = 12;

const drawing = (boundary: Boundary) => {
  const points = boundary.rings.flat();
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const west = Math.min(...lons);
  const north = Math.max(...lats);
  const span = Math.max(Math.max(...lons) - west, north - Math.min(...lats)) || 1;
  const scale = (size - 2 * margin) / span;
  return boundary.rings.map((ring) => ring.map(([lon, lat]) => `${margin + (lon - west) * scale},${margin + (north - lat) * scale}`).join(" "));
};

function Shape({ boundary, label }: { boundary: Boundary; label: string }) {
  return (
    <svg className="boundary-shape" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {drawing(boundary).map((points, i) => (
        <polygon key={i} points={points} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
      ))}
    </svg>
  );
}

function Editor({ hubId, groupId, boundary, reload }: { hubId: string; groupId: string; boundary: Boundary | null; reload: () => void }) {
  const { t } = useI18n();
  const { show } = useNotice();
  const [text, setText] = useState(boundary?.type === "Polygon" ? textFromCorners(boundary.rings[0] ?? []) : "");
  const [busy, setBusy] = useState(false);

  const send = async (corners: ReturnType<typeof cornersFromText>) => {
    setBusy(true);
    const ok = await saveBoundary(hubId, groupId, corners).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) {
      show(t("groups.boundarySaved"));
      reload();
    } else {
      show(t("submitFailed"), "bad");
    }
  };

  const save = () => {
    const corners = cornersFromText(text);
    if (corners) void send(corners);
    else show(t("groups.boundaryInvalid"), "bad");
  };

  const clear = () => {
    setText("");
    void send(null);
  };

  return (
    <Stack>
      {boundary && boundary.rings.length > 0 ? <Shape boundary={boundary} label={t("groups.boundaryDrawing")} /> : <Empty text={t("groups.boundaryNone")} />}
      <TextareaControl label={t("groups.boundaryCorners")} rows={6} value={text} onChange={setText} />
      <div className="form-foot">
        <Button disabled={busy} onClick={save}>
          {t("groups.boundarySave")}
        </Button>
        <Button kind="quiet" disabled={busy || !boundary} onClick={clear}>
          {t("groups.boundaryClear")}
        </Button>
      </div>
    </Stack>
  );
}

export function GroupBoundary({ hubId, groupId }: { hubId: string; groupId: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => loadBoundary(hubId, groupId), [hubId, groupId]);
  return (
    <Card title={t("groups.boundary")}>
      {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
      {state.kind === "ready" ? <Editor key={JSON.stringify(state.value)} hubId={hubId} groupId={groupId} boundary={state.value} reload={reload} /> : null}
    </Card>
  );
}
