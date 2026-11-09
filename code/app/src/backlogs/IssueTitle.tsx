import "./backlogs.css";

const idLike = /^[A-Za-z]+-?\d+[A-Za-z]?$/;

const plain = (title: string) => title.replace(/\*\*/g, "").replace(/`/g, "");

export const titleParts = (title: string) => {
  const text = plain(title).trim();
  const at = text.indexOf(" ");
  const first = at === -1 ? text : text.slice(0, at);
  return idLike.test(first) && at !== -1 ? { code: first, rest: text.slice(at + 1) } : { code: "", rest: text };
};

export function IssueTitle({ title }: { title: string }) {
  const { code, rest } = titleParts(title);
  return (
    <>
      {code ? <span className="issue-code">{code}</span> : null}
      {code ? " " : null}
      {rest}
    </>
  );
}
