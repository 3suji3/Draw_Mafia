export type PromptCategory =
  | "동물"
  | "사람"
  | "직업"
  | "탈것"
  | "스포츠"
  | "학용품"
  | "음식"
  | "장소"
  | "자연"
  | "물건"
  | "생활용품"
  | "의류/패션";

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "동물",
  "사람",
  "직업",
  "탈것",
  "스포츠",
  "학용품",
  "음식",
  "장소",
  "자연",
  "물건",
  "생활용품",
  "의류/패션",
];

export type PromptPair = {
  citizenAction: string;
  mafiaAction: string;
  citizenSubject: string;
  mafiaSubject: string;
  category: PromptCategory;
};

export type ActionPair = {
  citizenAction: string;
  mafiaAction: string;
  allowedCategories: PromptCategory[];
};

export type SubjectPair = {
  citizenSubject: string;
  mafiaSubject: string;
  category: PromptCategory;
};

export function toCitizenPromptText(prompt: PromptPair): string {
  return `${prompt.citizenAction} ${prompt.citizenSubject}`;
}

export function toMafiaPromptText(prompt: PromptPair): string {
  return `${prompt.mafiaAction} ${prompt.mafiaSubject}`;
}
