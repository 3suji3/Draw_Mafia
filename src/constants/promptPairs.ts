import type { PromptPair } from "@/types/prompt";

type ActionPair = Pick<PromptPair, "citizenAction" | "mafiaAction">;
type SubjectPair = Pick<PromptPair, "citizenSubject" | "mafiaSubject" | "category">;

const ACTION_PAIRS: ActionPair[] = [
  { citizenAction: "먹는", mafiaAction: "마시는" },
  { citizenAction: "달리는", mafiaAction: "점프하는" },
  { citizenAction: "우는", mafiaAction: "화난" },
  { citizenAction: "웃는", mafiaAction: "노래하는" },
  { citizenAction: "쓰는", mafiaAction: "그리는" },
  { citizenAction: "읽는", mafiaAction: "넘기는" },
  { citizenAction: "자는", mafiaAction: "하품하는" },
  { citizenAction: "청소하는", mafiaAction: "닦는" },
  { citizenAction: "요리하는", mafiaAction: "굽는" },
  { citizenAction: "운전하는", mafiaAction: "타는" },
  { citizenAction: "공 차는", mafiaAction: "드리블하는" },
  { citizenAction: "수영하는", mafiaAction: "잠수하는" },
];

const SUBJECT_PAIRS: SubjectPair[] = [
  { citizenSubject: "고양이", mafiaSubject: "강아지", category: "동물" },
  { citizenSubject: "사자", mafiaSubject: "호랑이", category: "동물" },
  { citizenSubject: "토끼", mafiaSubject: "다람쥐", category: "동물" },
  { citizenSubject: "학생", mafiaSubject: "어린이", category: "사람" },
  { citizenSubject: "요리사", mafiaSubject: "제빵사", category: "직업" },
  { citizenSubject: "의사", mafiaSubject: "간호사", category: "직업" },
  { citizenSubject: "경찰차", mafiaSubject: "소방차", category: "탈것" },
  { citizenSubject: "자전거", mafiaSubject: "킥보드", category: "탈것" },
  { citizenSubject: "축구공", mafiaSubject: "농구공", category: "스포츠" },
  { citizenSubject: "연필", mafiaSubject: "크레파스", category: "학용품" },
];

export const PROMPT_PAIRS: PromptPair[] = ACTION_PAIRS.flatMap((actionPair) =>
  SUBJECT_PAIRS.map((subjectPair) => ({
    citizenAction: actionPair.citizenAction,
    mafiaAction: actionPair.mafiaAction,
    citizenSubject: subjectPair.citizenSubject,
    mafiaSubject: subjectPair.mafiaSubject,
    category: subjectPair.category,
  }))
);
