import { ACTION_PAIRS } from "./actionPairs";
import { SUBJECT_PAIRS } from "./subjectPairs";
import type { PromptPair } from "@/types/prompt";

export const PROMPT_PAIRS: PromptPair[] = ACTION_PAIRS.flatMap((actionPair) =>
  SUBJECT_PAIRS
    .filter((subjectPair) => actionPair.allowedCategories.includes(subjectPair.category))
    .map((subjectPair) => ({
      citizenAction: actionPair.citizenAction,
      mafiaAction: actionPair.mafiaAction,
      citizenSubject: subjectPair.citizenSubject,
      mafiaSubject: subjectPair.mafiaSubject,
      category: subjectPair.category,
    }))
);

export function getRandomPromptPair(): PromptPair {
  if (ACTION_PAIRS.length === 0 || SUBJECT_PAIRS.length === 0) {
    throw new Error("Prompt source data is empty.");
  }

  const actionPair = ACTION_PAIRS[Math.floor(Math.random() * ACTION_PAIRS.length)];
  const subjectCandidates = SUBJECT_PAIRS.filter((subjectPair) =>
    actionPair.allowedCategories.includes(subjectPair.category)
  );

  if (subjectCandidates.length === 0) {
    throw new Error("No compatible subject pair for selected action pair.");
  }

  const subjectPair = subjectCandidates[Math.floor(Math.random() * subjectCandidates.length)];

  return {
    citizenAction: actionPair.citizenAction,
    mafiaAction: actionPair.mafiaAction,
    citizenSubject: subjectPair.citizenSubject,
    mafiaSubject: subjectPair.mafiaSubject,
    category: subjectPair.category,
  };
}
