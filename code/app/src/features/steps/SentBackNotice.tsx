import { useLanguage } from "../../shared/language/language";
import { dateTimeWords } from "../../shared/ui/days";
import { MessageBox } from "../../shared/ui/MessageBox";
import type { SentBackNotice as Notice } from "./api";

export function SentBackNotice({ notice }: { notice: Notice }) {
  const { words } = useLanguage();
  const title = words.stepSentBackTitle.replace("{role}", notice.roleName).replace("{at}", dateTimeWords(notice.at) ?? notice.at);
  return <MessageBox tone="info" title={title} words={notice.reason} />;
}
