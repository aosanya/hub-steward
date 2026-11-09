import { Chip } from "../ui/Chip";
import type { Issue } from "./api";
import { tagsOf, toneOf } from "./tags";

type Props = { issue: Issue; place: number; chosen: string[]; onOpen: () => void; onTag: (tag: string) => void };

export function IssueRow({ issue, place, chosen, onOpen, onTag }: Props) {
  return (
    <div className="row issue-row">
      <span className="rank">{place}</span>
      <span className="txt">
        <button type="button" className="open" onClick={onOpen}>
          {issue.title}
        </button>
        <span className="tags">
          {tagsOf(issue).map((tag) => (
            <Chip key={tag} tone={toneOf(tag, issue)} pressed={chosen.includes(tag)} onClick={() => onTag(tag)}>
              {tag}
            </Chip>
          ))}
        </span>
      </span>
    </div>
  );
}
