import { ACTION_PAIRS } from "./actionPairs";
import { SUBJECT_PAIRS } from "./subjectPairs";
import type { ActionPair, PromptPair, SubjectPair } from "@/types/prompt";

function buildPromptPairs(actionPairs: ActionPair[], subjectPairs: SubjectPair[]): PromptPair[] {
  return actionPairs.flatMap((actionPair) =>
    subjectPairs
      .filter((subjectPair) => actionPair.allowedCategories.includes(subjectPair.category))
      .map((subjectPair) => ({
        citizenAction: actionPair.citizenAction,
        mafiaAction: actionPair.mafiaAction,
        citizenSubject: subjectPair.citizenSubject,
        mafiaSubject: subjectPair.mafiaSubject,
        category: subjectPair.category,
      }))
  );
}

function assertNoDuplicates(label: string, values: string[]) {
  const seen = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} detected: ${value}`);
    }

    seen.add(value);
  });
}

assertNoDuplicates(
  "action pair",
  ACTION_PAIRS.map((actionPair) => `${actionPair.citizenAction}|${actionPair.mafiaAction}`)
);
assertNoDuplicates(
  "subject pair",
  SUBJECT_PAIRS.map(
    (subjectPair) => `${subjectPair.category}|${subjectPair.citizenSubject}|${subjectPair.mafiaSubject}`
  )
);

export const PROMPT_PAIRS: PromptPair[] = buildPromptPairs(ACTION_PAIRS, SUBJECT_PAIRS);

assertNoDuplicates(
  "prompt pair",
  PROMPT_PAIRS.map(
    (promptPair) =>
      `${promptPair.category}|${promptPair.citizenAction}|${promptPair.mafiaAction}|${promptPair.citizenSubject}|${promptPair.mafiaSubject}`
  )
);

export const PROMPT_SOURCE_STATS = {
  actionPairCount: ACTION_PAIRS.length,
  subjectPairCount: SUBJECT_PAIRS.length,
  promptPairCount: PROMPT_PAIRS.length,
} as const;

export function getRandomPromptPair(): PromptPair {
  if (ACTION_PAIRS.length === 0 || SUBJECT_PAIRS.length === 0) {
    throw new Error("Prompt source data is empty.");
  }

  // 액션과 제시어를 완전히 독립적으로 선택 (필터링 없음)
  const actionPair = ACTION_PAIRS[Math.floor(Math.random() * ACTION_PAIRS.length)];
  const subjectPair = SUBJECT_PAIRS[Math.floor(Math.random() * SUBJECT_PAIRS.length)];

  return {
    citizenAction: actionPair.citizenAction,
    mafiaAction: actionPair.mafiaAction,
    citizenSubject: subjectPair.citizenSubject,
    mafiaSubject: subjectPair.mafiaSubject,
    category: subjectPair.category,
  };
}
