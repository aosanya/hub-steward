import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { ListRow, Rows } from "../ui/ListRow";
import { mcpPublishClient, type PublishClient, type PublishedReport, type ReportFile } from "./publishApi";

const readable = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const readableDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
};

const shortVersion = (version: string) => version.slice(0, 7);

export function PublishReport({ formName, client = mcpPublishClient }: { formName: string; client?: PublishClient }) {
  const [formId, setFormId] = useState<string | null>(null);
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [selected, setSelected] = useState<ReportFile | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [published, setPublished] = useState<PublishedReport | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([client.holds(), client.closedFormId(formName)])
      .then(async ([holds, id]) => {
        const earlier = holds && id ? await client.latest(id).catch(() => null) : null;
        const stored = holds && id ? await client.files(id).catch(() => []) : [];
        if (!current) return;
        setFormId(holds ? id : null);
        setPublished(earlier);
        setFiles(stored);
      })
      .catch(() => {
        if (current) setFormId(null);
      });
    return () => {
      current = false;
    };
  }, [client, formName]);

  if (!formId) return null;

  const when = published ? readable(published.publishedAt) : "";
  const publish = async () => {
    if (!selected) return;
    setSending(true);
    setFailed(false);
    try {
      setPublished(await client.publish(formId, selected.path, selected.version));
    } catch {
      setFailed(true);
    }
    setSending(false);
  };

  return (
    <>
      {published ? (
        <p>
          Version {published.version}: {published.gitPath}, public since {when}
        </p>
      ) : null}
      {files.length === 0 ? (
        <p>No report file is stored for this step yet.</p>
      ) : (
        <>
          <Rows>
            {files.map((file) => (
              <ListRow
                key={`${file.path}@${file.version}`}
                title={file.name}
                meta={[shortVersion(file.version), readableDate(file.committedAt)]}
                pressed={selected === file}
                onClick={() => setSelected(file)}
              />
            ))}
          </Rows>
          {failed ? <p className="ferr">The report could not be published. Try again.</p> : null}
          <Button kind="primary" disabled={!selected || sending} onClick={publish}>
            Publish
          </Button>
        </>
      )}
    </>
  );
}
