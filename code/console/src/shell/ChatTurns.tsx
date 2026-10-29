import type { Turn } from "../data/modelChat";
import { MsgAssistant, MsgForm, MsgList, MsgTools, MsgUser } from "../ui";

export function ChatTurns({ turns }: { turns: Turn[] }) {
  return (
    <>
      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <MsgUser key={index}>{turn.shown ?? turn.content}</MsgUser>
        ) : (
          <div key={index} className="turn-bot">
            {turn.calls && turn.calls.length > 0 ? <MsgTools calls={turn.calls} /> : null}
            {turn.answer?.kind === "tools" ? <MsgList title={turn.answer.prompt} count={turn.answer.rows.length} /> : null}
            {turn.answer?.kind === "action" ? <MsgForm title={turn.answer.title || turn.answer.prompt} /> : null}
            <MsgAssistant>{turn.content}</MsgAssistant>
          </div>
        ),
      )}
    </>
  );
}
