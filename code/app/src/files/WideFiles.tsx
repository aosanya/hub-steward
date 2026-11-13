import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import type { FilesClient, Folder, FolderEntry } from "./api";
import { FileTree } from "./FileTree";
import { lastNameOf, parentPathOf, topLevel } from "./folderTrail";
import { focusTab, noTabs, openTab, showNoTab, withoutTab, type Tab, type Tabs } from "./openTabs";
import { filesHomePath, pathParam } from "./paths";
import { PropertiesPanel, type Selection } from "./PropertiesPanel";
import { TabStrip } from "./TabStrip";
import { ancestorsOf, treeRows } from "./treeRows";
import { useListings } from "./useListings";
import { Description, FileContent } from "./WideContent";
import "./wideFiles.css";

type Start = Tab | null;

const tabFor = (entry: FolderEntry): Tab => ({ path: entry.path, name: entry.name, folder: entry.folder });

const startAt = (path: string | null, isFile: boolean): Start => (path ? { path, name: lastNameOf(path), folder: !isFile } : null);

const revealing = (start: Start) => (start ? [...ancestorsOf(start.path), ...(start.folder ? [start.path] : [])] : []);

function FilesWindow({ client, folder, start }: { client: FilesClient; folder: Folder; start: Start }) {
  const [tabs, setTabs] = useState<Tabs>(() => (start ? openTab(noTabs, start) : noTabs));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(revealing(start)));
  const folderTabs = tabs.open.filter((tab) => tab.folder).map((tab) => tab.path);
  const wanted = useMemo(() => [...new Set([topLevel, ...expanded, ...folderTabs])], [expanded, folderTabs.join("\n")]);
  const listings = useListings(client, folder, wanted);
  const rootEntries = listings.entries[topLevel];
  const active = tabs.open.find((tab) => tab.path === tabs.active) ?? null;

  const reveal = (path: string) => setExpanded((was) => new Set([...was, ...ancestorsOf(path)]));
  const toggle = (path: string) =>
    setExpanded((was) => {
      const next = new Set(was);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const focus = (path: string) => {
    reveal(path);
    setTabs((was) => focusTab(was, path));
  };

  const sizeOf = (path: string) => listings.entries[parentPathOf(path)]?.find((entry) => entry.path === path)?.size ?? null;
  const selection: Selection | null = active
    ? { path: active.path, name: active.name, folder: active.folder, size: active.folder ? null : sizeOf(active.path), items: listings.entries[active.path]?.length ?? null }
    : { path: topLevel, name: folder.name, folder: true, size: null, items: rootEntries?.length ?? null };
  const propertiesReady = active ? !active.folder || selection.items !== null : Boolean(rootEntries && rootEntries.length > 0);

  const content = () => {
    if (active && !active.folder) return <FileContent key={active.path} client={client} folder={folder} path={active.path} />;
    const path = active ? active.path : topLevel;
    const answer = listings.answers[path];
    if (!answer) return <LoadingLine />;
    if (answer.status === "failed") return <LoadFailed words="The Folder could not be loaded." onRetry={() => listings.retry(path)} />;
    if (answer.status === "missing") return <EmptyCard words="Folder not found" />;
    return <Description key={path} client={client} folder={folder} path={path} empty={answer.entries.length === 0} />;
  };

  return (
    <div className="wf">
      <div className="wf-panes">
        <FileTree
          folderName={folder.name}
          rows={treeRows(listings.entries, expanded)}
          selected={tabs.active}
          onFolder={() => setTabs(showNoTab)}
          onEntry={(entry) => setTabs((was) => openTab(was, tabFor(entry)))}
          onToggle={toggle}
        />
        <div className="wf-main">
          <TabStrip tabs={tabs.open} active={tabs.active} onFocus={focus} onClose={(path) => setTabs((was) => withoutTab(was, path))} />
          <div className="wf-content">{content()}</div>
        </div>
        {propertiesReady ? <PropertiesPanel client={client} folder={folder} selection={selection} /> : null}
      </div>
      <footer className="wf-status" aria-label="Status bar" />
    </div>
  );
}

export function WideFiles({ client }: { client: FilesClient }) {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [params] = useSearchParams();
  const onFile = useLocation().pathname.endsWith("/file");
  const [attempt, setAttempt] = useState(0);
  const folders = useLoad(() => client.folders(), `wide-folders:${openAgencyId()}:${attempt}`);
  const known = folders.state === "ready" ? (folderId ? folders.data.find((one) => one.id === folderId) : folders.data[0]) : undefined;
  return (
    <Shell title={known?.name ?? "Files"} backLabel="Folders" onBack={() => navigate(filesHomePath())} tabless>
      {folders.state === "loading" ? <LoadingLine /> : null}
      {folders.state === "error" ? <LoadFailed words="The Folders could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
      {folders.state === "ready" && folders.data.length === 0 ? <EmptyCard words="No Folders yet" /> : null}
      {folders.state === "ready" && folders.data.length > 0 && !known ? <EmptyCard words="Folder not found" /> : null}
      {known ? <FilesWindow key={known.id} client={client} folder={known} start={startAt(params.get(pathParam), onFile)} /> : null}
    </Shell>
  );
}
