import { useState } from "react";

type Props = { placeholder: string; onSend: (body: string) => Promise<void> };

export function Composer({ placeholder, onSend }: Props) {
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState("");
  const ready = body.trim() !== "";
  const send = async () => {
    if (!ready) return;
    setProblem("");
    try {
      await onSend(body.trim());
      setBody("");
    } catch {
      setProblem("Your message was not sent. Try again.");
    }
  };
  return (
    <div className="rm-composer">
      {problem ? <p className="ferr">{problem}</p> : null}
      <div className="rm-compose-row">
        <input
          className="rm-field"
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button type="button" className={ready ? "rm-send ready" : "rm-send"} aria-label="Send" disabled={!ready} onClick={send}>
          ↑
        </button>
      </div>
    </div>
  );
}
