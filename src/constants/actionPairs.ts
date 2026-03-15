import type { ActionPair, PromptCategory } from "@/types/prompt";

const LIVING_CATEGORIES: PromptCategory[] = ["동물", "사람", "직업"];
const OBJECT_CATEGORIES: PromptCategory[] = ["물건", "생활용품", "학용품", "의류/패션"];
const SCENE_CATEGORIES: PromptCategory[] = ["장소", "자연"];

function action(
  citizenAction: string,
  mafiaAction: string,
  allowedCategories: PromptCategory[]
): ActionPair {
  return { citizenAction, mafiaAction, allowedCategories };
}

export const ACTION_PAIRS: ActionPair[] = [
  action("먹는", "마시는", [...LIVING_CATEGORIES, "음식"]),
  action("달리는", "점프하는", [...LIVING_CATEGORIES, "스포츠"]),
  action("우는", "화난", LIVING_CATEGORIES),
  action("웃는", "노래하는", LIVING_CATEGORIES),
  action("쓰는", "그리는", ["사람", "직업", "학용품", "물건"]),
  action("읽는", "넘기는", ["사람", "직업", "학용품", "물건"]),
  action("자는", "하품하는", LIVING_CATEGORIES),
  action("청소하는", "닦는", ["사람", "직업", "장소", ...OBJECT_CATEGORIES]),
  action("요리하는", "굽는", ["사람", "직업", "음식", "생활용품"]),
  action("운전하는", "타는", ["사람", "직업", "탈것"]),
  action("공 차는", "드리블하는", ["사람", "직업", "스포츠"]),
  action("수영하는", "잠수하는", [...LIVING_CATEGORIES, "스포츠", "자연"]),
  action("걷는", "뛰어가는", LIVING_CATEGORIES),
  action("앉아있는", "무릎 꿇은", LIVING_CATEGORIES),
  action("손드는", "박수치는", ["사람", "직업"]),
  action("이야기하는", "속삭이는", ["사람", "직업"]),
  action("전화하는", "문자하는", ["사람", "직업", "물건", "생활용품"]),
  action("가리키는", "살펴보는", ["사람", "직업", "동물", ...OBJECT_CATEGORIES, ...SCENE_CATEGORIES]),
  action("들고 가는", "끌고 가는", ["사람", "직업", ...OBJECT_CATEGORIES, "음식"]),
  action("여는", "닫는", ["사람", "직업", ...OBJECT_CATEGORIES, "장소"]),
  action("미는", "당기는", ["사람", "직업", "탈것", ...OBJECT_CATEGORIES]),
  action("던지는", "받는", ["사람", "직업", "스포츠", "물건", "음식"]),
  action("붙이는", "떼는", ["사람", "직업", ...OBJECT_CATEGORIES]),
  action("자르는", "오리는", ["사람", "직업", "음식", "학용품", "생활용품"]),
  action("씻는", "헹구는", ["사람", "직업", "동물", "음식", ...OBJECT_CATEGORIES]),
  action("양치하는", "입 헹구는", ["사람", "직업", "생활용품"]),
  action("사진 찍는", "촬영하는", ["사람", "직업", "동물", ...SCENE_CATEGORIES, "의류/패션"]),
  action("연주하는", "노래하는", ["사람", "직업"]),
  action("춤추는", "빙글도는", ["사람", "직업", "동물", "의류/패션"]),
  action("기어가는", "미끄러지는", ["동물", "사람", "스포츠"]),
  action("심는", "물 주는", ["사람", "직업", "자연"]),
  action("낚시하는", "그물 던지는", ["사람", "직업", "자연"]),
  action("입는", "벗는", ["사람", "직업", "의류/패션"]),
  action("매는", "묶는", ["사람", "직업", "의류/패션", "생활용품"]),
  action("정리하는", "쌓는", ["사람", "직업", ...OBJECT_CATEGORIES]),
  action("포장하는", "풀어보는", ["사람", "직업", "물건", "음식", "생활용품"]),
  action("고르는", "비교하는", ["사람", "직업", "음식", ...OBJECT_CATEGORIES]),
  action("켜는", "끄는", ["사람", "직업", "물건", "생활용품", "장소"]),
  action("씌우는", "덮는", ["사람", "직업", "동물", "물건", "생활용품", "의류/패션"]),
  action("갈아입는", "단추 잠그는", ["사람", "직업", "의류/패션"]),
  action("서빙하는", "나르는", ["사람", "직업", "음식", "생활용품"]),
  action("배달하는", "전달하는", ["사람", "직업", "물건", "음식", "생활용품"]),
  action("세우는", "눕히는", ["사람", "직업", "탈것", "물건", "생활용품"]),
  action("올라가는", "내려가는", ["사람", "직업", "탈것", "장소", "자연", "스포츠"]),
  action("응원하는", "환호하는", ["사람", "직업", "스포츠"]),
  action("펴는", "접는", ["사람", "직업", "학용품", "물건", "의류/패션"]),
  action("열어보는", "꺼내는", ["사람", "직업", ...OBJECT_CATEGORIES]),
  action("돌리는", "멈추는", ["사람", "직업", "탈것", "물건", "생활용품"]),
  action("뿌리는", "바르는", ["사람", "직업", "생활용품", "음식", "자연"]),
  action("건네는", "받아드는", ["사람", "직업", "물건", "음식", "생활용품", "학용품"]),
  action("매달린", "올라탄", ["동물", "사람", "직업", "탈것", "자연"]),
  action("기다리는", "찾아보는", ["사람", "직업", "장소", "탈것"]),
];
