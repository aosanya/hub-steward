import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { mcpPublishClient, type PublishClient, type PublishedReport } from "./publishApi";

const readable = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

export function PublishReport({ formName, client = mcpPublishClient }: { formName: string; client?: PublishClient }) {
  const [formId, setFormId] = useState<string | null>(null);
  const [file, setFile] = useState("");
  const [version, setVersion] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [published, setPublished] = useState<PublishedReport | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([client.holds(), client.closedFormId(formName)])
      .then(async ([holds, id]) => {
        const earlier = holds && id ? await client.latest(id).catch(() => null) : null;
        if (!current) return;
        setFormId(holds ? id : null);
        setPublished(earlier);
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
  const ready = file.trim() !== "" && version.trim() !== "";
  const publish = async () => {
    setSending(true);
    setFailed(false);
    try {
      setPublished(await client.publish(formId, file.trim(), version.trim()));
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
      <Field label="Report file" value={file} onChange={(e) => setFile(e.target.value)} />
      <Field label="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
      {failed ? <p className="ferr">The report could not be published. Try again.</p> : null}
      <Button kind="primary" disabled={!ready || sending} onClick={publish}>
        Publish
      </Button>
    </>
  );
}
