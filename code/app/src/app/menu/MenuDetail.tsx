import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { Shell } from "../Shell";
import { useBackToSection } from "./useBackToSection";

export const loadFailedWords = "This could not be loaded.";

export const actionFailedWords = "That did not go through.";

type Action = { label: string; tool: string };

type Props = { title: string; tool: string; fields: Record<string, string>; status: string; action?: Action; id?: string; bare?: boolean };

type Item = Record<string, unknown>;

const textOf = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const itemOf = (reply: unknown): Item => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Item) : {};
};

export function MenuDetail({ title, tool, fields, status, action, id: chosen, bare }: Props) {
  const back = useBackToSection();
  const params = useParams();
  const id = chosen ?? params.id;
  const [acting, setActing] = useState<"idle" | "busy" | "failed">("idle");
  const view = useLoad(async () => itemOf(await callTool("", tool, id ? { id } : {})), `menu-detail:${openAgencyId()}:${tool}:${id ?? ""}`);
  const item = view.state === "ready" ? view.data : {};
  const shown = Object.entries(fields).filter(([, key]) => textOf(item, key) !== "");
  const state = textOf(item, status);
  const act = async () => {
    if (!action) return;
    setActing("busy");
    try {
      await callTool("", action.tool, { id: textOf(item, "id") || id });
      setActing("idle");
    } catch {
      setActing("failed");
    }
  };
  const body = (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" ? (
        <>
          {state ? <Chip>{state}</Chip> : null}
          <Rows>
            {shown.map(([label, key]) => (
              <ListRow key={label} title={label} meta={textOf(item, key)} />
            ))}
          </Rows>
          {action ? (
            <Button kind="primary" disabled={acting === "busy"} onClick={act}>{action.label}</Button>
          ) : null}
          {acting === "failed" ? <LoadFailed words={actionFailedWords} /> : null}
        </>
      ) : null}
    </>
  );
  return bare ? body : <Shell title={title} titleUnder {...back}>{body}</Shell>;
}
