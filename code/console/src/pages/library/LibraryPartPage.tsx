import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { LibraryKind } from "../../data/pages/library";
import { useI18n } from "../../i18n";
import { Empty, Stack, StatusLine, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { kindSetups, loadEntries, type LibraryEntry } from "./libraryKinds";
import { libraryHref } from "./libraryLinks";
import { LibraryPartForm } from "./LibraryPartForm";
import { LibraryPartTable } from "./LibraryPartTable";

export function LibraryPartPage({ hubId, kind }: { hubId: string; kind: LibraryKind }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = kindSetups[kind];
  const adding = params.get("add") === "1";
  const opened = params.get("open") ?? "";
  const { state, reload } = useLoaded(() => loadEntries(hubId, kind), [hubId, kind]);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const back = libraryHref(hubId, kind);

  const onDelete = async (entry: LibraryEntry) => {
    setBusy(true);
    setRefused("");
    try {
      await setup.remove(hubId, entry.id);
      reload();
    } catch (failure) {
      setRefused((failure instanceof Error && failure.message) || t("submitFailed"));
    }
    setBusy(false);
  };

  const done = () => {
    navigate(back);
    reload();
  };

  const existing = state.kind === "ready" ? state.value.find((entry) => entry.id === opened) : undefined;
  const form =
    adding || existing ? (
      <LibraryPartForm key={opened || "new"} hubId={hubId} kind={kind} existing={adding ? undefined : existing} onDone={done} onCancel={() => navigate(back)} />
    ) : null;

  return (
    <>
      <TitleRow title={t(setup.menuKey)} primary={t(setup.addKey)} primaryTo={libraryHref(hubId, kind, { add: true })} />
      <div className="content">
        <Stack>
          {refused ? <StatusLine text={refused} failed /> : null}
          {form}
          {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
          {state.kind === "ready" ? <LibraryPartTable hubId={hubId} kind={kind} entries={state.value} busy={busy} onDelete={onDelete} /> : null}
        </Stack>
      </div>
    </>
  );
}
