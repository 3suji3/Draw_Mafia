export type PromptPair = {
  citizenAction: string;
  mafiaAction: string;
  citizenSubject: string;
  mafiaSubject: string;
  category: string;
};

export function toCitizenPromptText(prompt: PromptPair): string {
  return `${prompt.citizenAction} ${prompt.citizenSubject}`;
}

export function toMafiaPromptText(prompt: PromptPair): string {
  return `${prompt.mafiaAction} ${prompt.mafiaSubject}`;
}
