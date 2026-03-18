import type { ActionPair, PromptCategory } from "@/types/prompt";

const ACTOR_CATEGORIES: PromptCategory[] = ["동물", "사람", "직업", "위인"];
const HUMAN_CATEGORIES: PromptCategory[] = ["사람", "직업", "위인"];
const OBJECT_CATEGORIES: PromptCategory[] = ["물건", "생활용품", "학용품", "의류/패션"];
const OBJECT_EXTENDED_CATEGORIES: PromptCategory[] = [
  "물건",
  "생활용품",
  "학용품",
  "의류/패션",
  "음식",
  "탈것",
  "스포츠",
];

function action(
  citizenAction: string,
  mafiaAction: string,
  allowedCategories: PromptCategory[]
): ActionPair {
  return { citizenAction, mafiaAction, allowedCategories };
}

export const ACTION_PAIRS: ActionPair[] = [
  action("달리는", "뛰는", ACTOR_CATEGORIES),
  action("걷는", "산책하는", ACTOR_CATEGORIES),
  action("점프하는", "넘어가는", ACTOR_CATEGORIES),
  action("우는", "웃는", ACTOR_CATEGORIES),
  action("자는", "하품하는", ACTOR_CATEGORIES),
  action("앉아있는", "서있는", ACTOR_CATEGORIES),
  action("기어가는", "미끄러지는", [...ACTOR_CATEGORIES, "스포츠"]),

  action("노래하는", "춤추는", HUMAN_CATEGORIES),
  action("말하는", "속삭이는", HUMAN_CATEGORIES),
  action("손드는", "박수치는", HUMAN_CATEGORIES),
  action("공부하는", "필기하는", HUMAN_CATEGORIES),
  action("읽는", "암기하는", HUMAN_CATEGORIES),
  action("쓰는", "그리는", HUMAN_CATEGORIES),
  action("요리하는", "굽는", HUMAN_CATEGORIES),
  action("씻는", "양치하는", HUMAN_CATEGORIES),
  action("청소하는", "정리하는", HUMAN_CATEGORIES),
  action("운전하는", "조종하는", HUMAN_CATEGORIES),
  action("타는", "내리는", HUMAN_CATEGORIES),
  action("수영하는", "잠수하는", HUMAN_CATEGORIES),
  action("낚시하는", "탐색하는", HUMAN_CATEGORIES),
  action("사진 찍는", "촬영하는", HUMAN_CATEGORIES),
  action("심는", "물 주는", HUMAN_CATEGORIES),
  action("기다리는", "찾아보는", HUMAN_CATEGORIES),
  action("응원하는", "환호하는", HUMAN_CATEGORIES),
  action("배달하는", "전달하는", HUMAN_CATEGORIES),
  action("서빙하는", "나르는", HUMAN_CATEGORIES),
  action("올라가는", "내려가는", HUMAN_CATEGORIES),
  action("가리키는", "관찰하는", HUMAN_CATEGORIES),
  action("연주하는", "지휘하는", HUMAN_CATEGORIES),
  action("여행하는", "탐험하는", HUMAN_CATEGORIES),
  action("놀아주는", "훈련하는", HUMAN_CATEGORIES),

  action("고르는", "비교하는", OBJECT_EXTENDED_CATEGORIES),
  action("들고 가는", "옮기는", OBJECT_EXTENDED_CATEGORIES),
  action("여는", "닫는", [...OBJECT_CATEGORIES, "장소"]),
  action("켜는", "끄는", ["물건", "생활용품", "장소"]),
  action("붙이는", "떼는", OBJECT_CATEGORIES),
  action("접는", "펴는", OBJECT_CATEGORIES),
  action("포장하는", "풀어보는", OBJECT_EXTENDED_CATEGORIES),
  action("건네는", "받아드는", OBJECT_EXTENDED_CATEGORIES),
  action("입는", "벗는", ["의류/패션"]),
  action("매는", "묶는", ["의류/패션", "생활용품"]),
  action("던지는", "받는", ["스포츠", "물건", "음식"]),
  action("차는", "드리블하는", ["스포츠"]),
  action("씌우는", "덮는", ["물건", "생활용품", "의류/패션"]),
  action("정비하는", "고치는", ["탈것", "물건", "생활용품"]),
  action("꾸미는", "장식하는", ["의류/패션", "물건", "장소"]),
  action("자르는", "써는", ["음식", "생활용품", "학용품"]),
  
  // 위인과 잘 맞는 새로운 액션들
  action("선언하는", "연설하는", HUMAN_CATEGORIES),
  action("통치하는", "지배하는", HUMAN_CATEGORIES),
  action("발견하는", "발명하는", HUMAN_CATEGORIES),
  action("역사를 쓰는", "업적을 남기는", HUMAN_CATEGORIES),
];
