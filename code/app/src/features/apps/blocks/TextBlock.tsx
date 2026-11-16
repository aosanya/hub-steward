export function TextBlock({ from, text }: { from: "agent" | "me"; text: string }) {
  return (
    <div className={from === "me" ? "msg mine" : "msg"}>
      <p className="bubble">{text}</p>
    </div>
  );
}
