import { useRef, useState } from "react";

type Props = { placeholder: string; onSend: (body: string) => Promise<void> };

export function Composer({ placeholder, onSend }: Props) {
  const field = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const ready = body.trim() !== "" && !sending;
  const send = async () => {
    if (!ready) return;
    setProblem("");
    setSending(true);
    try {
      await onSend(body.trim());
      setBody("");
      field.current?.focus();
    } catch {
      setProblem("Your message was not sent. Try again.");
    }
    setSending(false);
  };
  return (
    <div className="rm-composer">
      {problem ? <p className="ferr">{problem}</p> : null}
      <div className="rm-compose-row">
        <input
          ref={field}
          className="rm-field"
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button type="button" className={ready ? "rm-send ready" : "rm-send"} aria-label={sending ? "Sending" : "Send"} disabled={!ready} onClick={send}>
          ↑
        </button>
      </div>
    </div>
  );
}
