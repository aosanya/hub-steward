import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemsOf } from "../../features/backlogs";
import { useLoad } from "../../features/forms/useLoad";
import { Button } from "../../shared/ui/Button";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { SearchBox } from "../../shared/ui/SearchBox";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { Shell } from "../Shell";
import { useBackToSection } from "./useBackToSection";

export const searchWords = "Search";

export const loadFailedWords = "This list could not be loaded.";

type Fields = { title: string; meta: string };

type Empty = { words: string; act: string; to: string };

type Props = { title: string; tool: string; fields: Fields; empty: Empty; bare?: boolean; selectedId?: string; onChoose?: (id: string) => void };

const textOf = (item: Record<string, unknown>, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export function MenuList({ title, tool, fields, empty, bare, selectedId, onChoose }: Props) {
  const navigate = useNavigate();
  const back = useBackToSection();
  const [typed, setTyped] = useState("");
  const view = useLoad(async () => itemsOf(await callTool("", tool)) as Record<string, unknown>[], `menu-list:${openAgencyId()}:${tool}`);
  const rows = view.state === "ready" ? view.data : [];
  const wanted = typed.trim().toLocaleLowerCase();
  const shown = rows.filter((item) => `${textOf(item, fields.title)} ${textOf(item, fields.meta)}`.toLocaleLowerCase().includes(wanted));
  const body = (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" && rows.length === 0 ? (
        <EmptyCard words={empty.words}>
          <Button kind="primary" onClick={() => navigate(empty.to)}>{empty.act}</Button>
        </EmptyCard>
      ) : null}
      {rows.length > 0 ? (
        <>
          <SearchBox label={searchWords} value={typed} onChange={setTyped} />
          <Rows>
            {shown.map((item, at) => (
              <ListRow
                key={textOf(item, "id") || at}
                title={textOf(item, fields.title)}
                meta={textOf(item, fields.meta)}
                onClick={onChoose ? () => onChoose(textOf(item, "id")) : undefined}
                pressed={onChoose ? selectedId === textOf(item, "id") : undefined}
              />
            ))}
          </Rows>
        </>
      ) : null}
    </>
  );
  return bare ? body : <Shell title={title} titleUnder {...back}>{body}</Shell>;
}
