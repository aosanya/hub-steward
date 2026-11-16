import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { agoWords } from "./ago";
import type { Changed, FilesClient, Folder } from "./api";
import { kindOf } from "./fileKind";
import { formatSize } from "./viewer/formatSize";

export type Selection = { path: string; name: string; folder: boolean; size: number | null; items: number | null };

const dash = "–";

const textOrDash = (value: string | null | undefined) => value || dash;

const answered = (changed: Changed | null | undefined) => ({
  when: textOrDash(changed ? agoWords(changed.when) : ""),
  author: textOrDash(changed?.author),
});

const linesFor = (selection: Selection, changed: Changed | null | undefined): [string, string][] => {
  const { when, author } = answered(changed);
  const path = selection.path === "" ? "/" : selection.path;
  const own: [string, string][] = selection.folder
    ? [["Items", selection.items === null ? dash : String(selection.items)]]
    : [
        ["Kind", kindOf(selection.name)],
        ["Size", selection.size === null ? dash : formatSize(selection.size)],
      ];
  return [["Name", selection.name], ["Path", path], ...own, ["Last changed", when], ["Changed by", author]];
};

type Props = { client: FilesClient; folder: Folder; selection: Selection };

export function PropertiesPanel({ client, folder, selection }: Props) {
  const changed = useLoad(() => client.changed(folder, selection.path).catch(() => null), `properties:${openAgencyId()}:${folder.id}:${selection.path}`);
  const lines = linesFor(selection, changed.state === "ready" ? changed.data : null);
  return (
    <aside className="wf-props" aria-label="Properties">
      <h2 className="wf-head">Properties</h2>
      <dl className="wf-lines">
        {lines.map(([term, value]) => (
          <div key={term} className="wf-line">
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
