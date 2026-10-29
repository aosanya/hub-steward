import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountMenu } from "../../ui/AccountMenu";
import { DrawerFrame } from "../../ui/DrawerFrame";
import { ScreenHead } from "../../ui/ScreenHead";
import { TopBar } from "../../ui/TopBar";
import { BlockView } from "../blocks";
import type { Block } from "../blocks/types";
import type { AgentSource } from "./source";
import "./thread.css";

type Props = {
  appName: string;
  agentName?: string;
  source: AgentSource;
  backTo?: string;
  backLabel?: string;
};

const failure: Block = { kind: "text", from: "agent", text: "The agent could not answer. Try again." };

export function AppThreadPage({ appName, agentName = "", source, backTo = "/", backLabel = "Do Something" }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const blocksRef = useRef<Block[]>([]);
  const end = useRef<HTMLDivElement>(null);

  const append = (added: Block[]) => {
    blocksRef.current = [...blocksRef.current, ...added];
    setBlocks(blocksRef.current);
  };

  const ask = async (run: () => Promise<Block[]>) => {
    setBusy(true);
    try {
      append(await run());
    } catch {
      append([failure]);
    } finally {
      setBusy(false);
    }
  };

  const runTool = async (block: Block, tool: string, args: Record<string, unknown>) => {
    const answer = await source.submit(block, block.kind === "form" ? args : { tool, ...args });
    append(answer);
    return undefined;
  };

  useEffect(() => {
    let live = true;
    source.opening().then(
      (opening) => live && append(opening),
      () => live && append([failure]),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [blocks]);

  const send = (text: string) => {
    const said = text.trim();
    if (said === "" || busy) return;
    const before = blocksRef.current;
    append([{ kind: "text", from: "me", text: said }]);
    void ask(() => source.reply(said, before));
  };

  const onSubmitForm = (event: FormEvent) => {
    event.preventDefault();
    const said = draft;
    setDraft("");
    send(said);
  };

  return (
    <DrawerFrame drawer={<AccountMenu />}>
      <div className="thread-page">
        <TopBar back={{ to: backTo, label: backLabel }} menu />
        <ScreenHead title={appName} sub={agentName} />
        <main className="thread-scroll" aria-label="Thread">
          {blocks.map((block, index) => (
            <BlockView
              key={index}
              block={block}
              onPrompt={send}
              onTool={(tool, args) => runTool(block, tool, args)}
            />
          ))}
          <div ref={end} />
        </main>
        <form className="thread-composer" onSubmit={onSubmitForm}>
          <span className="cfield">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Write to the ${agentName || "agent"}`}
              aria-label={`Write to the ${agentName || "agent"}`}
            />
          </span>
          <button type="submit" className={`send${draft.trim() ? " ready" : ""}`} disabled={busy || draft.trim() === ""}>
            Send
          </button>
        </form>
      </div>
    </DrawerFrame>
  );
}
