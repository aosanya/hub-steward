import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Segmented } from "../../../../shared/ui/Segmented";
import { callTool } from "../../../../shared/wakala/mcp";
import { routes } from "../../../routes";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";

const raiseTool = "forms_catalog_raised_item_raise";

type Sender = "named" | "anonymous";

const senders = [
  { id: "named" as const, label: "Give my name" },
  { id: "anonymous" as const, label: "Stay anonymous" },
];

const answersOf = (values: { title: string; topic: string; street: string }, sender: Sender) => ({
  title: values.title.trim(),
  ...(values.topic.trim() ? { topic: values.topic.trim() } : {}),
  ...(values.street.trim() ? { street: values.street.trim() } : {}),
  anonymous: sender === "anonymous",
});

const empty = { title: "", topic: "", street: "" };

export function SendWishScreen() {
  const navigate = useNavigate();
  const [values, setValues] = useState(empty);
  const [sender, setSender] = useState<Sender>("named");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [refused, setRefused] = useState("");
  const set = (key: keyof typeof empty, value: string) => setValues((was) => ({ ...was, [key]: value }));
  const send = async () => {
    setSending(true);
    setRefused("");
    try {
      await callTool("", raiseTool, answersOf(values, sender));
      setSent(true);
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSending(false);
    }
  };
  const another = () => {
    setValues(empty);
    setSender("named");
    setSent(false);
  };
  return (
    <Shell title="Send a Wish" titleUnder backLabel="Issues & Requests" onBack={() => navigate(routes.menu.path({ sectionId: "issues" }))} tabless>
      {sent ? (
        <>
          <p role="status">Your wish was sent.</p>
          <Button kind="primary" onClick={another}>Send another wish</Button>
        </>
      ) : (
        <>
          <Field label="Your wish" value={values.title} onChange={(event) => set("title", event.target.value)} />
          <Field label="Topic (optional)" value={values.topic} onChange={(event) => set("topic", event.target.value)} />
          <Field label="Street (optional)" value={values.street} onChange={(event) => set("street", event.target.value)} />
          <Segmented label="Who sends it" items={senders} current={sender} onChange={setSender} />
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={sending || !values.title.trim()} onClick={send}>Send</Button>
        </>
      )}
    </Shell>
  );
}
