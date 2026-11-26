import { useLanguage } from "../../../shared/language/language";
import type { Words } from "../../../shared/language/words";
import type { RuleKind } from "./types";

export const rulebookWords = (t: Words) => {
  const counts: Record<RuleKind, [string, string]> = {
    rule: [t.rbCountRuleOne, t.rbCountRuleMany],
    decision: [t.rbCountDecisionOne, t.rbCountDecisionMany],
    question: [t.rbCountQuestionOne, t.rbCountQuestionMany],
  };
  return {
    viewWords: { rules: t.rbRules, decisions: t.rbDecisions, questions: t.questionsTitle },
    kindTitle: { rule: t.rbKindRule, decision: t.rbKindDecision, question: t.rbKindQuestion } as Record<RuleKind, string>,
    countWords: (kind: RuleKind, n: number) => counts[kind][n === 1 ? 0 : 1].replace("{count}", String(n)),
    statusWords: {
      rule: { proposed: t.rbStatusProposed, in_force: t.rbStatusInForce, superseded: t.rbStatusSuperseded, retired: t.rbStatusRetired },
      decision: { proposed: t.rbStatusProposed, decided: t.rbStatusDecided, superseded: t.rbStatusSuperseded },
      question: { open: t.rbStatusOpen, answered: t.rbStatusAnswered, dropped: t.rbStatusDropped },
    },
    supersededByWords: (code: string) => t.rbSupersededBy.replace("{code}", code),
    replacesWords: (code: string) => (code === "" ? t.rbReplacesNothing : t.rbReplaces.replace("{code}", code)),
    replacedByWords: (code: string) => (code === "" ? t.rbReplacedByNothing : t.rbReplacedBy.replace("{code}", code)),
    emptyWords: { rule: t.rbEmptyRule, decision: t.rbEmptyDecision, question: t.rbEmptyQuestion } as Record<RuleKind, string>,
    searchWords: { rule: t.rbSearchRule, decision: t.rbSearchDecision, question: t.rbSearchQuestion } as Record<RuleKind, string>,
    noSearchMatchWords: t.rbNoSearchMatch,
    noMatchWords: t.rbNoMatch,
    whyHeading: { rule: t.rbWhy, decision: t.rbWhy, question: t.rbWhyQuestion } as Record<RuleKind, string>,
    decidedByWords: (name: string, date: string) =>
      (date === "" ? t.rbDecidedBy : t.rbDecidedByOn).replace("{name}", name).replace("{date}", date),
    goodExampleWords: t.rbGoodExample,
    fileMissingWords: t.rbFileMissing,
    issuesHeading: t.rbIssues,
    producedHeading: t.rbProduced,
    settledInWords: t.rbSettledIn,
    answeredByWords: t.rbAnsweredBy,
    notAnsweredWords: t.rbNotAnswered,
    columnWords: { code: t.rbColCode, title: t.rbColTitle, status: t.rbColStatus, tags: t.rbColTags },
    rowWords: { status: t.rbColStatus, tags: t.rbColTags, priority: t.rbRowPriority, decided: t.rbStatusDecided },
    detailsHeading: t.rbDetails,
    referencesHeading: t.rbReferences,
    repoLineWords: (repo: string) => t.rbRepoLine.replace("{repo}", repo),
    missingRecordWords: t.rbMissingRecord,
    noAccessWords: t.rbNoAccess,
    loadFailedWords: { list: t.rbLoadFailedList, record: t.rbLoadFailedRecord },
  };
};

export type RulebookWords = ReturnType<typeof rulebookWords>;

export const useRulebookWords = (): RulebookWords => rulebookWords(useLanguage().words);
